import { AnnouncementScope, UserRole } from '@prisma/client';
import {
  ANNOUNCEMENT_MAX_CONTENT_LENGTH,
  ANNOUNCEMENT_MAX_HEADING_LENGTH,
} from '../constants/announcement.constants';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../dtos/announcement.dto';
import type { IUser } from '../dtos/auth.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
import logger from './logger';

// ---------------------------------------------------------------------------
// ID parsing
// ---------------------------------------------------------------------------

export function parsePositiveId(raw: string | undefined, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Valid ${label} is required`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateHeadingAndContent(heading: string, content: string): void {
  if (!heading) throw new BadRequestError('heading is required');
  if (!content) throw new BadRequestError('content is required');
  if (heading.length > ANNOUNCEMENT_MAX_HEADING_LENGTH) {
    throw new BadRequestError(`heading must be at most ${ANNOUNCEMENT_MAX_HEADING_LENGTH} characters`);
  }
  if (content.length > ANNOUNCEMENT_MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`content must be at most ${ANNOUNCEMENT_MAX_CONTENT_LENGTH} characters`);
  }
}

export function validateAnnouncementDates(startDate: Date, endDate: Date): void {
  if (endDate < startDate) {
    throw new BadRequestError('endDate must be on or after startDate');
  }
}

export function validateTargetRequirements(
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  courseIds: number[],
  batchIds: number[],
): void {
  if (scope === AnnouncementScope.COURSE && targetAllCourses && courseIds.length > 0) {
    throw new BadRequestError('courseIds must be empty when targetAllCourses is true');
  }
  if (scope === AnnouncementScope.COURSE && !targetAllCourses && courseIds.length === 0) {
    throw new BadRequestError('courseIds required when scope is COURSE and targetAllCourses is false');
  }
  if (scope === AnnouncementScope.BATCH && targetAllBatches && batchIds.length > 0) {
    throw new BadRequestError('batchIds must be empty when targetAllBatches is true');
  }
  if (scope === AnnouncementScope.BATCH && !targetAllBatches && batchIds.length === 0) {
    throw new BadRequestError('batchIds required when scope is BATCH and targetAllBatches is false');
  }
}

// ---------------------------------------------------------------------------
// Target normalisation / construction
// ---------------------------------------------------------------------------

export function normalizeAnnouncementTargets(
  dto: CreateAnnouncementDto | UpdateAnnouncementDto,
  existingTargets?: {
    scope: AnnouncementScope;
    targetAllCourses: boolean;
    targetAllBatches: boolean;
    courseIds: number[];
    batchIds: number[];
  },
): {
  scope: AnnouncementScope;
  targetAllCourses: boolean;
  targetAllBatches: boolean;
  courseIds: number[];
  batchIds: number[];
} {
  const scope = dto.scope ?? existingTargets?.scope;
  if (scope === undefined) {
    throw new BadRequestError('scope is required');
  }

  return {
    scope,
    targetAllCourses: dto.targetAllCourses ?? existingTargets?.targetAllCourses ?? false,
    targetAllBatches: dto.targetAllBatches ?? existingTargets?.targetAllBatches ?? false,
    courseIds: dto.courseIds ?? existingTargets?.courseIds ?? [],
    batchIds: dto.batchIds ?? existingTargets?.batchIds ?? [],
  };
}

export function makeAnnouncementTargets(
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  courseIds: number[],
  batchIds: number[],
): Array<{ courseId?: number | null; batchId?: number | null }> {
  if (scope === AnnouncementScope.COURSE) {
    return targetAllCourses ? [] : courseIds.map((courseId) => ({ courseId, batchId: null }));
  }
  if (scope === AnnouncementScope.BATCH) {
    return targetAllBatches ? [] : batchIds.map((batchId) => ({ batchId, courseId: null }));
  }
  return [];
}
