import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { BadRequestError } from '../errors/api.errors';
import logger from '../utils/logger';

const EDITOR_IMAGE_DIR = process.env.EDITOR_IMAGE_UPLOAD_DIR || 'uploads/editor';

// Ensure the output directory exists at startup
try {
  if (!fs.existsSync(EDITOR_IMAGE_DIR)) {
    fs.mkdirSync(EDITOR_IMAGE_DIR, { recursive: true });
  }
} catch (err) {
  logger.error('[EditorImageService] Failed to create upload directory', err);
}

export class EditorImageService {
  /**
   * Converts the uploaded temp file to WebP, saves it to the editor image
   * directory, removes the original temp file, and returns the public URL path.
   */
  async uploadImage(tempFilePath: string): Promise<string> {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputFilename = `editor-${uniqueSuffix}.webp`;
    const outputPath = path.join(EDITOR_IMAGE_DIR, outputFilename).replace(/\\/g, '/');

    // Convert to WebP (quality 80 — good balance of size and clarity)
    await sharp(tempFilePath).webp({ quality: 80 }).toFile(outputPath);

    // Remove the original multer temp file — we only keep the converted WebP
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // Non-fatal; OS will clean it up eventually
    }

    const publicUrl = `/${outputPath}`;
    logger.info(`[EditorImageService] Image uploaded and converted: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Deletes a previously uploaded editor image from disk.
   * Validates that the path is within the allowed editor image directory
   * to prevent path-traversal attacks.
   */
  deleteImage(url: string): void {
    if (!url || typeof url !== 'string') {
      throw new BadRequestError('url is required');
    }

    // Strip leading slash and resolve to an absolute path
    const relative = url.replace(/^\/+/, '');
    const resolved = path.resolve(relative);
    const allowedDir = path.resolve(EDITOR_IMAGE_DIR);

    // Security check — only allow deletion within the editor image directory
    if (!resolved.startsWith(allowedDir + path.sep) && resolved !== allowedDir) {
      throw new BadRequestError('Invalid file path');
    }

    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      logger.info(`[EditorImageService] Image deleted: ${resolved}`);
    }
  }
}

export const editorImageService = new EditorImageService();
