// src/errors/api.errors.ts
import { Response } from 'express';
import { ApiResponseHandler, ApiCode } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { EMAIL_VERIFICATION_MESSAGES } from '../constants/emailVerification.constants';

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
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND);
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
    super(message, HTTP_STATUS.CONFLICT);
    this.name = 'AlreadyExistsError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request') {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.name = 'BadRequestError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.badRequest(res, this.message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.unauthorized(res, this.message);
  }
}

export class AuthError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN);
    this.name = 'ForbiddenError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.forbidden(res, this.message);
  }
}

export class SessionAlreadyActiveError extends ApiError {
  constructor(
    message: string = 'You are already logged in on another device or browser. Please log out from there first, or wait for that session to expire before logging in again.',
  ) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = 'SessionAlreadyActiveError';
  }

  override respond(res: Response): void {
    res.status(this.statusCode).json({
      success: false,
      apiCode: ApiCode.ERR_SESSION_ALREADY_ACTIVE,
      message: this.message,
    });
  }
}

export class EmailNotVerifiedError extends ApiError {
  email: string;

  constructor(email: string, message: string = EMAIL_VERIFICATION_MESSAGES.EMAIL_NOT_VERIFIED) {
    super(message, HTTP_STATUS.FORBIDDEN);
    this.name = 'EmailNotVerifiedError';
    this.email = email;
  }

  override respond(res: Response): void {
    res.status(this.statusCode).json({
      success: false,
      apiCode: ApiCode.ERR_EMAIL_NOT_VERIFIED,
      message: this.message,
      email: this.email,
    });
  }
}

export class VerificationLinkInvalidError extends ApiError {
  constructor(message: string = EMAIL_VERIFICATION_MESSAGES.LINK_INVALID) {
    super(message, HTTP_STATUS.BAD_REQUEST);
    this.name = 'VerificationLinkInvalidError';
  }

  override respond(res: Response): void {
    ApiResponseHandler.error(res, this.message, this.statusCode, ApiCode.ERR_VERIFICATION_LINK_INVALID);
  }
}

export class VerificationLinkExpiredError extends ApiError {
  email: string;

  constructor(email: string, message: string = EMAIL_VERIFICATION_MESSAGES.LINK_EXPIRED) {
    super(message, HTTP_STATUS.GONE);
    this.name = 'VerificationLinkExpiredError';
    this.email = email;
  }

  override respond(res: Response): void {
    res.status(this.statusCode).json({
      success: false,
      apiCode: ApiCode.ERR_VERIFICATION_LINK_EXPIRED,
      message: this.message,
      email: this.email,
    });
  }
}

export class BusinessSuspendedError extends ApiError {
  action: string;
  reason: string | null | undefined;

  constructor(action: string, reason?: string | null) {
    super(`Business access restricted (${action})`, HTTP_STATUS.FORBIDDEN);
    this.name = 'BusinessSuspendedError';
    this.action = action;
    this.reason = reason;
  }

  override respond(res: Response): void {
    res.status(this.statusCode).json({
      success: false,
      apiCode: ApiCode.ERR_BUSINESS_SUSPENDED,
      action: this.action,
      ...(this.reason ? { reason: this.reason } : {}),
    });
  }
}
