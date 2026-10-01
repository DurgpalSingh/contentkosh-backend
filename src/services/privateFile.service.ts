import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { NotFoundError } from '../errors/api.errors';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
import logger from '../utils/logger';

/**
 * Stores and streams files that must never be publicly reachable. Callers work with
 * storage keys (paths relative to the private root, always `/`-separated); absolute
 * paths never leave this service.
 */
export class PrivateFileService {
  constructor(private readonly rootDir: string) {}

  /** Resolves a storage key to an absolute path, refusing anything outside the private root. */
  resolveSafePath(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Storage key resolves outside the private root: ${key}`);
    }
    return resolved;
  }

  buildKey(...segments: Array<string | number>): string {
    return segments.map(String).join('/');
  }

  /** Moves an uploaded temp file (already inside the private root) to its final key. */
  async moveIntoPlace(tempPath: string, key: string): Promise<void> {
    const target = this.resolveSafePath(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.rename(tempPath, target);
  }

  async streamFile(res: Response, key: string, downloadName: string, contentType: string): Promise<void> {
    const absolutePath = this.resolveSafePath(key);
    const stat = await fs.promises.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
      logger.warn(`[private-file] missing file key=${key}`);
      throw new NotFoundError('File');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(toSafeFileName(downloadName))}`);
    res.setHeader('Cache-Control', 'private, no-store');

    const stream = fs.createReadStream(absolutePath);
    stream.on('error', (error) => {
      logger.error(`[private-file] stream failed key=${key}: ${error.message}`);
      res.destroy(error);
    });
    stream.pipe(res);
  }

  /** Best-effort delete of one key. Never throws; a leftover file is logged, not fatal. */
  async deleteQuietly(key: string | null | undefined): Promise<void> {
    if (!key) return;
    try {
      await fs.promises.rm(this.resolveSafePath(key), { force: true });
    } catch (error) {
      logger.error(`[private-file] delete failed key=${key}: ${(error as Error).message}`);
    }
  }

  /** Best-effort recursive delete of a key prefix (e.g. a test's folder). Never throws. */
  async deleteFolderQuietly(keyPrefix: string): Promise<void> {
    try {
      await fs.promises.rm(this.resolveSafePath(keyPrefix), { recursive: true, force: true });
    } catch (error) {
      logger.error(`[private-file] folder delete failed key=${keyPrefix}: ${(error as Error).message}`);
    }
  }
}

function toSafeFileName(name: string): string {
  const cleaned = name.replace(/[^\w\-. ]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'file';
}

export const privateFileService = new PrivateFileService(SUBJECTIVE_TEST_CONFIG.privateRootDir);
