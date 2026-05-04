// ---------------------------------------------------------------------------
// Shared throw helpers 
// ---------------------------------------------------------------------------

import { UserRole } from "@prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors/api.errors";
import logger from "./logger";
import { IUser } from "../dtos/auth.dto";

export function throwBadRequest(message: string): never {
  logger.warn(`[announcement] bad request: ${message}`);
  throw new BadRequestError(message);
}

export function throwForbidden(message: string, role: UserRole): never {
  logger.warn(`[announcement] forbidden [role=${role}]: ${message}`);
  throw new ForbiddenError(`${message} (role: ${role})`);
}

export function throwNotFound(resource: string): never {
  logger.warn(`[announcement] not found: ${resource}`);
  throw new NotFoundError(resource);
}

export function requireBusinessId(user: IUser): number {
  if (user.businessId === null || user.businessId === undefined) {
    logger.warn(`[announcement] missing businessId userId=${user.id} role=${user.role}`);
    throwForbidden('Business context required', user.role);
  }
  return user.businessId;
}

export function parseIsoDate(label: string, value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throwBadRequest(`Invalid ${label}`);
  }
  return d;
}
