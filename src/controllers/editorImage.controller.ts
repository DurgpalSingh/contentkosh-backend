import { Response } from 'express';
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

    // The service always removes the temp file, on success and on failure.
    const url = await editorImageService.uploadImage(req.file.path, req.user!.businessId);
    ApiResponseHandler.success(res, { url }, 'Image uploaded successfully', 201);
  } catch (error) {
    handleControllerError(res, error, 'Failed to upload image', '[editorImage] Upload failed');
  }
};

/**
 * DELETE /api/editor/image
 * Body: { url: "/uploads/editor/<businessId>/editor-xxx.webp" } (absolute URLs are accepted too)
 * Delegates file deletion to EditorImageService.
 */
export const deleteEditorImage = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    await editorImageService.deleteImage(url ?? '', req.user!);
    ApiResponseHandler.success(res, null, 'Image deleted successfully');
  } catch (error) {
    handleControllerError(res, error, 'Failed to delete image', '[editorImage] Delete failed');
  }
};
