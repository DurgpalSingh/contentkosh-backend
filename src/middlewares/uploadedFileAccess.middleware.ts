import { NextFunction, Response } from 'express';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiResponseHandler } from '../utils/apiResponse';
import { canViewUploadedFile } from '../services/uploadedFileAccess.service';
import { CACHE_CONTROL_VALUES, HTTP_HEADERS } from '../constants/httpHeaders.constants';
import logger from '../utils/logger';

/**
 * Runs after `authenticate` on the `/uploads` static mount. Answers 404 (not 403) when the viewer
 * may not see the file, so the response never reveals whether a file exists.
 */
export async function authorizeUploadedFileAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await canViewUploadedFile(req.user!, req.path)) {
      res.setHeader(HTTP_HEADERS.CACHE_CONTROL, CACHE_CONTROL_VALUES.PRIVATE_SHORT);
      next();
      return;
    }
    ApiResponseHandler.notFound(res, 'File not found');
  } catch (error) {
    logger.error(`[uploaded-file-access] check failed path=${req.path}: ${(error as Error).message}`);
    ApiResponseHandler.serverError(res, 'Failed to load file');
  }
}
