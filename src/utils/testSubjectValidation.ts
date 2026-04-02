import { SubjectStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import logger from './logger';
import * as batchRepo from '../repositories/batch.repo';
import * as subjectRepo from '../repositories/subject.repo';

type AssertSubjectForBatchParams = {
  batchId: number;
  subjectId: number;
  businessId: number;
  userId: number;
};

export async function assertSubjectForBatch(params: AssertSubjectForBatchParams): Promise<void> {
  const { batchId, subjectId, businessId, userId } = params;

  const batch = await batchRepo.findBatchById(batchId);
  if (!batch) {
    logger.warn('[test-module] Subject validation failed: batch not found', {
      businessId,
      userId,
      batchId,
      subjectId,
    });
    throw new NotFoundError('Batch not found');
  }

  const subject = await subjectRepo.findSubjectById(subjectId);
  if (!subject) {
    logger.warn('[test-module] Subject validation failed: subject not found', {
      businessId,
      userId,
      batchId,
      subjectId,
    });
    throw new NotFoundError('Subject not found');
  }

  if (subject.status !== SubjectStatus.ACTIVE) {
    logger.warn('[test-module] Subject validation failed: subject inactive', {
      businessId,
      userId,
      batchId,
      subjectId,
      subjectStatus: subject.status,
    });
    throw new BadRequestError('Subject must be active');
  }

  if (subject.courseId !== batch.courseId) {
    logger.warn('[test-module] Subject validation failed: subject course mismatch', {
      businessId,
      userId,
      batchId,
      subjectId,
      batchCourseId: batch.courseId,
      subjectCourseId: subject.courseId,
    });
    throw new BadRequestError('Subject does not belong to this batch');
  }
}

