import { Response } from 'express';
import { ApiError } from '../errors/api.errors';
import { ApiResponseHandler } from './apiResponse';
import logger from './logger';

/**
 * Shared catch-block handler for controllers: every ApiError subclass knows how to
 * render itself via `respond()`, so this never needs to branch on the concrete type.
 * Anything that isn't an ApiError is logged and reported as a generic failure.
 */
export function handleControllerError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  logContext: string,
): void {
  if (error instanceof ApiError) {
    error.respond(res);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(`${logContext}: ${message}`);
  ApiResponseHandler.error(res, fallbackMessage);
}
