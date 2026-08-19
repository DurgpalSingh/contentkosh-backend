import { Response } from 'express';
import * as fs from 'fs';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiResponseHandler } from '../utils/apiResponse';
import { BadRequestError } from '../errors/api.errors';
import { editorImageService } from '../services/editorImage.service';
import { handleControllerError } from '../utils/controllerErrorHandler';

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
  } catch (error) {
    // Clean up the temp file on any failure
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    handleControllerError(res, error, 'Failed to upload image', '[editorImage] Upload failed');
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
  } catch (error) {
    handleControllerError(res, error, 'Failed to delete image', '[editorImage] Delete failed');
  }
};
