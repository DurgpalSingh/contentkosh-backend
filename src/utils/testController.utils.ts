import { Response } from 'express';
import logger from './logger';
import { ApiResponseHandler } from './apiResponse';
import { BadRequestError, NotFoundError } from '../errors/api.errors';

export function parseOptionalIntQueryParam(value: unknown, paramName: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) throw new BadRequestError(`Invalid ${paramName}`);

  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) throw new BadRequestError(`Invalid ${paramName}`);

  return parsed;
}

export function handleTestControllerError(params: {
  res: Response;
  error: unknown;
  endpoint: string;
  serverErrorMessage: string;
}): void {
  const { res, error, endpoint, serverErrorMessage } = params;

  if (error instanceof BadRequestError) return ApiResponseHandler.badRequest(res, error.message);
  if (error instanceof NotFoundError) return ApiResponseHandler.notFound(res, error.message);

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`[test-controller] ${endpoint}: ${message}`);
  return ApiResponseHandler.serverError(res, serverErrorMessage);
}

