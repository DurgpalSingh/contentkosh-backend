import { Response } from 'express';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
import { ApiResponseHandler } from './apiResponse';
import logger from './logger';

export function handleControllerError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  logContext: string,
): void {
  if (error instanceof NotFoundError) {
    ApiResponseHandler.notFound(res, error.message);
    return;
  }

  if (error instanceof BadRequestError) {
    ApiResponseHandler.error(res, error.message, 400);
    return;
  }

  if (error instanceof ForbiddenError) {
    ApiResponseHandler.error(res, error.message, 403);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(`${logContext}: ${message}`);
  ApiResponseHandler.error(res, fallbackMessage);
}

