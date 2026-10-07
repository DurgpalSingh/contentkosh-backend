import { NextFunction, Response } from 'express';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiResponseHandler } from '../utils/apiResponse';
import { canViewUploadedFile } from '../services/uploadedFileAccess.service';
import logger from '../utils/logger';

/**
 * Runs after `authenticate` on the `/uploads` static mount. Answers 404 (not 403) when the viewer
 * may not see the file, so the response never reveals whether a file exists.
 */
export async function authorizeUploadedFileAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await canViewUploadedFile(req.user!, req.path)) {
      res.setHeader('Cache-Control', 'private, max-age=300');
      next();
      return;
    }
    ApiResponseHandler.notFound(res, 'File not found');
  } catch (error) {
    logger.error(`[uploaded-file-access] check failed path=${req.path}: ${(error as Error).message}`);
    ApiResponseHandler.serverError(res, 'Failed to load file');
  }
}
