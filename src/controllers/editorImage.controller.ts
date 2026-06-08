import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiResponseHandler } from '../utils/apiResponse';
import { BadRequestError } from '../errors/api.errors';
import logger from '../utils/logger';

const EDITOR_IMAGE_DIR = process.env.EDITOR_IMAGE_UPLOAD_DIR || 'uploads/editor';

// Ensure the directory exists at startup
try {
  if (!fs.existsSync(EDITOR_IMAGE_DIR)) {
    fs.mkdirSync(EDITOR_IMAGE_DIR, { recursive: true });
  }
} catch (err) {
  logger.error('[editorImage] Failed to create upload directory', err);
}

/**
 * POST /api/editor/image
 * Accepts a raw image file via multer, converts it to WebP with sharp,
 * saves it to EDITOR_IMAGE_DIR, and returns the public URL path.
 */
export const uploadEditorImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const outputFilename = `editor-${uniqueSuffix}.webp`;
    const outputPath = path.join(EDITOR_IMAGE_DIR, outputFilename).replace(/\\/g, '/');

    // Convert to WebP using sharp (quality 80 — good balance of size and clarity)
    await sharp(req.file.path)
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Remove the original multer-saved file; we only keep the WebP
    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // Non-fatal — original will be cleaned up by OS eventually
    }

    const publicUrl = `/${outputPath}`;
    logger.info(`[editorImage] Image uploaded and converted: ${publicUrl}`);

    ApiResponseHandler.success(res, { url: publicUrl }, 'Image uploaded successfully', 201);
  } catch (error: any) {
    // Clean up the temp file on error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    if (error instanceof BadRequestError) {
      return ApiResponseHandler.error(res, error.message, 400);
    }
    logger.error(`[editorImage] Upload failed: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to upload image');
  }
};

/**
 * DELETE /api/editor/image
 * Body: { url: "/uploads/editor/editor-xxx.webp" }
 * Deletes the file from disk. Only allows deletion of files under EDITOR_IMAGE_DIR.
 */
export const deleteEditorImage = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
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
      logger.info(`[editorImage] Image deleted: ${resolved}`);
    }

    ApiResponseHandler.success(res, null, 'Image deleted successfully');
  } catch (error: any) {
    if (error instanceof BadRequestError) {
      return ApiResponseHandler.error(res, error.message, 400);
    }
    logger.error(`[editorImage] Delete failed: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to delete image');
  }
};
