import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { NotFoundError } from '../errors/api.errors';
import { FILE_STORAGE_CONFIG } from '../config/fileStorage.config';
import logger from '../utils/logger';

export type StoredFileDownload = {
  storageKey: string;
  downloadFileName: string;
  contentType: string;
};

const ORIGINAL_FILE_NAME_SEPARATOR = '__';
const MAX_ORIGINAL_FILE_NAME_LENGTH = 100;
const UNSAFE_FILE_NAME_CHARACTERS = /[^\p{L}\p{M}\p{N} ._-]+/gu;

/**
 * Stores and streams files under one root folder. Callers only use storage keys
 * (`/`-separated paths relative to the root); absolute paths never leave this class.
 */
export class FileStorageService {
  constructor(private readonly rootDir: string) {}

  /** Absolute path for a key; refuses keys that escape the root (e.g. `../../.env`). */
  resolveStoragePath(storageKey: string): string {
    const absolutePath = path.resolve(this.rootDir, storageKey);
    if (!absolutePath.startsWith(this.rootDir + path.sep)) {
      throw new NotFoundError('File');
    }
    return absolutePath;
  }

  joinStorageKey(...keyParts: Array<string | number>): string {
    return keyParts.map(String).join('/');
  }

  /**
   * Moves an uploaded temp file to `storageKey`, then runs `commitToDatabase`.
   * If the commit fails the new file is removed; `replacedStorageKey` (the old file) is
   * removed only after a successful commit, so a failed replace never loses the old file.
   */
  async saveUploadThenCommit<CommitResult>(params: {
    uploadedFile: Express.Multer.File;
    storageKey: string;
    commitToDatabase: () => Promise<CommitResult>;
    replacedStorageKey?: string | null;
  }): Promise<CommitResult> {
    const { uploadedFile, storageKey, commitToDatabase, replacedStorageKey } = params;
    const targetPath = this.resolveStoragePath(storageKey);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.rename(uploadedFile.path, targetPath);

    let commitResult: CommitResult;
    try {
      commitResult = await commitToDatabase();
    } catch (error) {
      await this.deleteFileIfExists(storageKey);
      throw error;
    }
    if (replacedStorageKey && replacedStorageKey !== storageKey) {
      await this.deleteFileIfExists(replacedStorageKey);
    }
    return commitResult;
  }

  async streamToResponse(res: Response, download: StoredFileDownload): Promise<void> {
    const absolutePath = this.resolveStoragePath(download.storageKey);
    const fileStats = await fs.promises.stat(absolutePath).catch(() => null);
    if (!fileStats?.isFile()) {
      logger.warn(`[file-storage] stream missing storageKey=${download.storageKey}`);
      throw new NotFoundError('File');
    }

    res.setHeader('Content-Type', download.contentType);
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(toHeaderSafeFileName(download.downloadFileName))}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');

    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (error) => {
      logger.error(`[file-storage] stream failed storageKey=${download.storageKey}: ${error.message}`);
      res.destroy(error);
    });
    fileStream.pipe(res);
  }

  /** Best-effort delete; a leftover file is logged, never thrown, so cleanup can't fail a request. */
  async deleteFileIfExists(storageKey: string | null | undefined): Promise<void> {
    if (!storageKey) return;
    try {
      await fs.promises.rm(this.resolveStoragePath(storageKey), { force: true });
    } catch (error) {
      logger.error(`[file-storage] delete failed storageKey=${storageKey}: ${(error as Error).message}`);
    }
  }

  async deleteFolderIfExists(folderKey: string): Promise<void> {
    try {
      await fs.promises.rm(this.resolveStoragePath(folderKey), { recursive: true, force: true });
    } catch (error) {
      logger.error(`[file-storage] folder delete failed folderKey=${folderKey}: ${(error as Error).message}`);
    }
  }
}

/**
 * The uploader's file name, safe to embed in a storage key. Multer decodes multipart file
 * names as latin1, so UTF-8 names (e.g. Hindi) are re-decoded first.
 */
export function toStorageSafeFileName(uploadedFile: Express.Multer.File): string {
  const decodedName = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8');
  const baseName = path.basename(decodedName.replace(/\\/g, '/'));
  const safeName = baseName
    .replace(UNSAFE_FILE_NAME_CHARACTERS, '_')
    .split(ORIGINAL_FILE_NAME_SEPARATOR)
    .join('_')
    .trim()
    .slice(-MAX_ORIGINAL_FILE_NAME_LENGTH);
  return safeName || 'file.pdf';
}

/** `<generatedName>__<originalFileName>` — keeps the uploader's name without a DB column. */
export function appendOriginalFileName(generatedName: string, originalFileName: string): string {
  return `${generatedName}${ORIGINAL_FILE_NAME_SEPARATOR}${originalFileName}`;
}

export function extractOriginalFileName(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const fileName = storageKey.slice(storageKey.lastIndexOf('/') + 1);
  const separatorIndex = fileName.indexOf(ORIGINAL_FILE_NAME_SEPARATOR);
  if (separatorIndex < 0) return null;
  return fileName.slice(separatorIndex + ORIGINAL_FILE_NAME_SEPARATOR.length) || null;
}

function toHeaderSafeFileName(fileName: string): string {
  const safeName = fileName.replace(UNSAFE_FILE_NAME_CHARACTERS, '_').trim();
  return safeName.length > 0 ? safeName : 'file';
}

/** Subjective test question papers, answer sheets and checked copies. Never served by URL. */
export const privateFileStorage = new FileStorageService(FILE_STORAGE_CONFIG.privateUploadsRootDir);

/** Batch content files (PDF/image/doc). Served only through the content file endpoint. */
export const contentFileStorage = new FileStorageService(FILE_STORAGE_CONFIG.contentUploadDir);
