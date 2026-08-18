// src/errors/api.errors.ts
import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Default rendering for generic/ad-hoc ApiErrors (e.g. one-off statusCode usages that
  // have no dedicated subclass). Subclasses override this to call the more specific
  // ApiResponseHandler method - callers never need to branch on the concrete error type.
  respond(res: Response): void {
    ApiResponseHandler.error(res, this.message, this.statusCode);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.notFound(res, this.message);
  }
}

export class AlreadyExistsError extends ApiError {
  constructor(resource: string = 'Resource') {
    const message = /already exists$/i.test(resource.trim())
      ? resource
      : `${resource} already exists`;
    super(message, 409); // HTTP 409 Conflict
    this.name = 'AlreadyExistsError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.badRequest(res, this.message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.unauthorized(res, this.message);
  }
}

export class AuthError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.forbidden(res, this.message);
  }
}
