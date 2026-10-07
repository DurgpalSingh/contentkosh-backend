import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import logger from './logger';
import { ApiResponseHandler } from './apiResponse';
import { ApiError, BadRequestError } from '../errors/api.errors';
import { AuthRequest } from '../dtos/auth.dto';

/** The logged-in user acting on a test endpoint. */
export type TestRequestActor = { id: number; role: UserRole };

export function getRequestActor(req: AuthRequest): TestRequestActor {
  return { id: req.user!.id, role: req.user!.role };
}

export function getBusinessId(req: Request): number {
  const businessId = Number(req.params.businessId);
  if (!businessId || !Number.isInteger(businessId)) {
    throw new BadRequestError('Invalid businessId');
  }
  return businessId;
}


export function parseOptionalIntQueryParam(value: unknown, paramName: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) throw new BadRequestError(`Invalid ${paramName}`);

  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) throw new BadRequestError(`Invalid ${paramName}`);

  return parsed;
}

export function parseOptionalStringQueryParam(value: unknown, paramName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new BadRequestError(`Invalid ${paramName}`);
  return value;
}

export function handleTestControllerError(params: {
  res: Response;
  error: unknown;
  endpoint: string;
  serverErrorMessage: string;
}): void {
  const { res, error, endpoint, serverErrorMessage } = params;

  if (error instanceof ApiError) {
    error.respond(res);
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`[test-controller] ${endpoint}: ${message}`);
  ApiResponseHandler.serverError(res, serverErrorMessage);
}
