import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { ApiError, NotFoundError } from '../errors/api.errors';
import { BulkUploadService } from '../services/bulkUpload.service';
import { handleTestControllerError, getBusinessId } from '../utils/testController.utils';
import logger from '../utils/logger';

const bulkUploadService = new BulkUploadService();

export const bulkUploadController = {
  async uploadAndPreview(req: AuthRequest, res: Response) {
    try {
      logger.info('BulkUpload: uploadAndPreview', { userId: req.user?.id, file: req.file?.originalname });
      getBusinessId(req);

      if (!req.file) {
        return ApiResponseHandler.badRequest(res, 'No file uploaded');
      }

      const { testId, testType } = req.body;
      if (!testId || !testType) {
        return ApiResponseHandler.badRequest(res, 'testId and testType are required');
      }

      const result = await bulkUploadService.parseAndPreview(req.file.buffer, req.file.mimetype, req.file.originalname, testId, testType);
      return ApiResponseHandler.success(res, result, 'File parsed successfully');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.statusCode === 422) {
        return res.status(422).json({ message: e.message });
      }
      if (e instanceof ApiError && e.statusCode === 410) {
        return res.status(410).json({ message: e.message });
      }
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'uploadAndPreview',
        serverErrorMessage: 'Failed to parse file',
      });
    }
  },

  async confirmUpload(req: AuthRequest, res: Response) {
    try {
      getBusinessId(req);

      const { sessionToken, testId, testType } = req.body;
      const result = await bulkUploadService.confirm(sessionToken, testId, testType);
      return ApiResponseHandler.success(res, result, 'Questions saved successfully');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.statusCode === 410) {
        return res.status(410).json({ message: e.message });
      }
      if (e instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, e.message);
      }
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'confirmUpload',
        serverErrorMessage: 'Failed to save questions',
      });
    }
  },
};
