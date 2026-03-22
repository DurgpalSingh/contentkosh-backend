import { Request } from 'express';
import { BadRequestError } from '../errors/api.errors';

export function getBusinessId(req: Request): number {
  const businessId = Number(req.params.businessId);
  if (!businessId || !Number.isInteger(businessId)) {
    throw new BadRequestError('Invalid businessId');
  }
  return businessId;
}
