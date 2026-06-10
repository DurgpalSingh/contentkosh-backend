import { Response } from 'express';
import * as fs from 'fs';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiResponseHandler } from '../utils/apiResponse';
import { BadRequestError } from '../errors/api.errors';
import { editorImageService } from '../services/editorImage.service';
import logger from '../utils/logger';

/**
 * POST /api/editor/image
 * Receives a file uploaded by multer, delegates conversion and storage
 * to EditorImageService, and returns the public URL.
 */
export const uploadEditorImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }

    const url = await editorImageService.uploadImage(req.file.path);
    ApiResponseHandler.success(res, { url }, 'Image uploaded successfully', 201);
  } catch (error: any) {
    // Clean up the temp file on any failure
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
 * Delegates file deletion to EditorImageService.
 */
export const deleteEditorImage = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    editorImageService.deleteImage(url ?? '');
    ApiResponseHandler.success(res, null, 'Image deleted successfully');
  } catch (error: any) {
    if (error instanceof BadRequestError) {
      return ApiResponseHandler.error(res, error.message, 400);
    }
    logger.error(`[editorImage] Delete failed: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to delete image');
  }
};
