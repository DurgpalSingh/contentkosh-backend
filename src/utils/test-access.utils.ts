import { BadRequestError, ForbiddenError } from '../errors/api.errors';
import * as batchRepo from '../repositories/batch.repo';
import logger from './logger';

export async function assertTeacherInBatch(userId: number, batchId: number): Promise<void> {
  const ok = await batchRepo.isActiveUserInBatch(userId, batchId);
  if (!ok) {
    logger.warn(`[test-access] assertTeacherInBatch forbidden userId=${userId} batchId=${batchId}`);
    throw new ForbiddenError('Access denied to this batch');
  }
}

export async function assertBatchBelongsToBusiness(businessId: number, batchId: number): Promise<void> {
  const batchBusinessId = await batchRepo.findBatchBusinessId(batchId);
  if (!batchBusinessId) throw new BadRequestError('Batch not found');
  if (batchBusinessId !== businessId) throw new BadRequestError('Batch does not belong to this business');
}
