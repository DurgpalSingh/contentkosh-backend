import { Request, Response, NextFunction } from 'express';
import { AlreadyExistsError, ApiError, BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../errors/api.errors';
import { ApiResponseHandler } from '../utils/apiResponse';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // Log full error for server-side debugging
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  if (err instanceof NotFoundError) {
    return ApiResponseHandler.notFound(res, err.message);
  }

  if (err instanceof BadRequestError) {
    return ApiResponseHandler.badRequest(res, err.message);
  }

  if (err instanceof AlreadyExistsError) {
    return ApiResponseHandler.error(res, err.message, 409);
  }

  if (err instanceof UnauthorizedError) {
    return ApiResponseHandler.unauthorized(res, err.message);
  }

  if (err instanceof ForbiddenError) {
    return ApiResponseHandler.forbidden(res, err.message);
  }

  if (err instanceof ApiError) {
    return ApiResponseHandler.error(res, err.message, err.statusCode);
  }

  // In non-production, include underlying error message to help debug provisioning issues
  // Do not leak stack traces in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && err instanceof Error) {
    return ApiResponseHandler.serverError(res, `Internal Server Error: ${err.message}`);
  }
  return ApiResponseHandler.serverError(res);
}