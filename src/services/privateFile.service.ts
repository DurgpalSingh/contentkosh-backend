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

/** Separates the generated part of a storage key from the uploader's original file name. */
const ORIGINAL_NAME_SEPARATOR = '__';
const MAX_ORIGINAL_NAME_LENGTH = 100;

/**
 * The uploader's file name, made safe to embed in a storage key (keeps letters and combining
 * marks in any script, digits, space, dot, dash, underscore). Multer decodes multipart names as latin1, so UTF-8
 * names (e.g. Hindi) are re-decoded first.
 */
export function toKeyFileName(file: Express.Multer.File): string {
  const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const baseName = path.basename(decoded.replace(/\\/g, '/'));
  const safe = baseName
    .replace(/[^\p{L}\p{M}\p{N} ._-]+/gu, '_')
    .replace(new RegExp(ORIGINAL_NAME_SEPARATOR, 'g'), '_')
    .trim()
    .slice(-MAX_ORIGINAL_NAME_LENGTH);
  return safe || 'file.pdf';
}

/** Appends the original name to a generated file name: `<generated>__<original>`. */
export function withOriginalName(generatedName: string, originalName: string): string {
  return `${generatedName}${ORIGINAL_NAME_SEPARATOR}${originalName}`;
}

/** Reads the original file name back out of a storage key; null for keys without one. */
export function originalNameFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const fileName = key.slice(key.lastIndexOf('/') + 1);
  const index = fileName.indexOf(ORIGINAL_NAME_SEPARATOR);
  return index >= 0 ? fileName.slice(index + ORIGINAL_NAME_SEPARATOR.length) || null : null;
}

function toSafeFileName(name: string): string {
  const cleaned = name.replace(/[^\w\-. ]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'file';
}

export const privateFileService = new PrivateFileService(SUBJECTIVE_TEST_CONFIG.privateRootDir);
