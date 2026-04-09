import { AnnouncementScope, UserRole } from '@prisma/client';
import {
  ANNOUNCEMENT_MAX_CONTENT_LENGTH,
  ANNOUNCEMENT_MAX_HEADING_LENGTH,
} from '../constants/announcement.constants';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../dtos/announcement.dto';
import type { IUser } from '../dtos/auth.dto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors/api.errors';
import * as announcementRepo from '../repositories/announcement.repo';
import type { AnnouncementUpdateRepoInput } from '../repositories/announcement.repo';
import {
  emitAnnouncementCreated,
  emitAnnouncementDeleted,
  emitAnnouncementUpdated,
} from '../sockets/announcementEmitter';
import logger from '../utils/logger';

function requireBusinessId(user: IUser): number {
  if (user.businessId === null || user.businessId === undefined) {
    logger.warn(`[announcement] missing businessId userId=${user.id} role=${user.role}`);
    throw new ForbiddenError('Business context required');
  }
  return user.businessId;
}

function parseIsoDate(label: string, value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestError(`Invalid ${label}`);
  }
  return d;
}

function assertAtLeastOneVisibility(
  visibleToAdmins: boolean,
  visibleToTeachers: boolean,
  visibleToStudents: boolean,
): void {
  if (!visibleToAdmins && !visibleToTeachers && !visibleToStudents) {
    throw new BadRequestError('At least one audience (admins, teachers, or students) must be selected');
  }
}

function buildTargetsFromDto(
  dto: CreateAnnouncementDto | UpdateAnnouncementDto,
  existing?: {
    scope: AnnouncementScope;
    targetAllCourses: boolean;
    targetAllBatches: boolean;
  },
): Array<{ courseId?: number | null; batchId?: number | null }> {
  const scope = dto.scope ?? existing?.scope;
  const targetAllCourses = dto.targetAllCourses ?? existing?.targetAllCourses;
  const targetAllBatches = dto.targetAllBatches ?? existing?.targetAllBatches;

  if (scope === undefined) {
    throw new BadRequestError('scope is required');
  }

  if (scope === AnnouncementScope.COURSE) {
    if (targetAllCourses) {
      return [];
    }
    const ids = dto.courseIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestError('courseIds required when scope is COURSE and targetAllCourses is false');
    }
    return ids.map((courseId) => ({ courseId, batchId: null }));
  }

  if (scope === AnnouncementScope.BATCH) {
    if (targetAllBatches) {
      return [];
    }
    const ids = dto.batchIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestError('batchIds required when scope is BATCH and targetAllBatches is false');
    }
    return ids.map((batchId) => ({ batchId, courseId: null }));
  }

  return [];
}

async function validateTargetsBelongToBusiness(
  businessId: number,
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  courseIds: number[],
  batchIds: number[],
): Promise<void> {
  if (scope === AnnouncementScope.COURSE && !targetAllCourses) {
    const ok = await announcementRepo.validateCourseIdsBelongToBusiness(businessId, courseIds);
    if (!ok) {
      throw new BadRequestError('One or more courses are invalid for this business');
    }
  }
  if (scope === AnnouncementScope.BATCH && !targetAllBatches) {
    const ok = await announcementRepo.validateBatchIdsBelongToBusiness(businessId, batchIds);
    if (!ok) {
      throw new BadRequestError('One or more batches are invalid for this business');
    }
  }
}

async function assertTeacherOwnsBatches(
  businessId: number,
  userId: number,
  batchIds: number[],
): Promise<void> {
  if (batchIds.length === 0) return;
  const allowed = new Set(await announcementRepo.findActiveBatchIdsForUser(businessId, userId));
  for (const bid of batchIds) {
    if (!allowed.has(bid)) {
      logger.warn(
        `[announcement] teacher batch denied userId=${userId} batchId=${bid}`,
      );
      throw new ForbiddenError('You can only target batches you belong to');
    }
  }
}

async function assertTeacherTargetAllBatches(
  businessId: number,
  userId: number,
): Promise<void> {
  const count = (await announcementRepo.findActiveBatchIdsForUser(businessId, userId)).length;
  if (count === 0) {
    throw new BadRequestError('You must belong to at least one batch to create announcements');
  }
}

export const announcementService = {
  async getMyAnnouncements(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getMyAnnouncements userId=${user.id} role=${user.role} businessId=${businessId}`);
    const rows = await announcementRepo.findMyAnnouncements(businessId, user.id, user.role);
    logger.info(`[announcement] getMyAnnouncements count=${rows.length}`);
    return rows;
  },

  async getManagedAnnouncements(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getManagedAnnouncements userId=${user.id} role=${user.role} businessId=${businessId}`);

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
      const rows = await announcementRepo.findAllForBusinessAdmin(businessId);
      logger.info(`[announcement] getManagedAnnouncements admin count=${rows.length}`);
      return rows;
    }

    if (user.role === UserRole.TEACHER) {
      const rows = await announcementRepo.findCreatedByUser(businessId, user.id);
      logger.info(`[announcement] getManagedAnnouncements teacher count=${rows.length}`);
      return rows;
    }

    throw new ForbiddenError('Not allowed to list managed announcements');
  },

  async createAnnouncement(user: IUser, dto: CreateAnnouncementDto) {
    const businessId = requireBusinessId(user);
    logger.info(
      `[announcement] create entry userId=${user.id} role=${user.role} businessId=${businessId} scope=${dto.scope}`,
    );

    const heading = dto.heading?.trim() ?? '';
    const content = dto.content?.trim() ?? '';
    if (!heading) throw new BadRequestError('heading is required');
    if (!content) throw new BadRequestError('content is required');
    if (heading.length > ANNOUNCEMENT_MAX_HEADING_LENGTH) {
      throw new BadRequestError(`heading must be at most ${ANNOUNCEMENT_MAX_HEADING_LENGTH} characters`);
    }
    if (content.length > ANNOUNCEMENT_MAX_CONTENT_LENGTH) {
      throw new BadRequestError(`content must be at most ${ANNOUNCEMENT_MAX_CONTENT_LENGTH} characters`);
    }

    const startDate = parseIsoDate('startDate', dto.startDate);
    const endDate = parseIsoDate('endDate', dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestError('endDate must be on or after startDate');
    }

    const visibleToAdmins = dto.visibleToAdmins ?? false;
    const visibleToTeachers = dto.visibleToTeachers ?? false;
    const visibleToStudents = dto.visibleToStudents ?? false;
    assertAtLeastOneVisibility(visibleToAdmins, visibleToTeachers, visibleToStudents);

    const targetAllCourses = dto.targetAllCourses ?? false;
    const targetAllBatches = dto.targetAllBatches ?? false;

    if (dto.scope === AnnouncementScope.COURSE && targetAllCourses && (dto.courseIds?.length ?? 0) > 0) {
      throw new BadRequestError('courseIds must be empty when targetAllCourses is true');
    }
    if (dto.scope === AnnouncementScope.BATCH && targetAllBatches && (dto.batchIds?.length ?? 0) > 0) {
      throw new BadRequestError('batchIds must be empty when targetAllBatches is true');
    }

    if (user.role === UserRole.TEACHER) {
      if (dto.scope !== AnnouncementScope.BATCH) {
        throw new BadRequestError('Teachers can only create batch-scoped announcements');
      }
      if (!visibleToStudents) {
        throw new BadRequestError('Teacher announcements must be visible to students');
      }
      if (targetAllCourses) {
        throw new BadRequestError('Invalid target flags for teacher announcement');
      }
      if (targetAllBatches) {
        await assertTeacherTargetAllBatches(businessId, user.id);
      } else {
        await assertTeacherOwnsBatches(businessId, user.id, dto.batchIds ?? []);
      }
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN && user.role !== UserRole.TEACHER) {
      throw new ForbiddenError('Not allowed to create announcements');
    }

    const courseIds = dto.courseIds ?? [];
    const batchIds = dto.batchIds ?? [];
    await validateTargetsBelongToBusiness(
      businessId,
      dto.scope,
      targetAllCourses,
      targetAllBatches,
      courseIds,
      batchIds,
    );

    const targets = buildTargetsFromDto({
      ...dto,
      targetAllCourses,
      targetAllBatches,
    });

    const created = await announcementRepo.createWithTargets({
      heading,
      content,
      startDate,
      endDate,
      isActive: dto.isActive ?? true,
      businessId,
      visibleToAdmins,
      visibleToTeachers,
      visibleToStudents,
      scope: dto.scope,
      targetAllCourses,
      targetAllBatches,
      createdBy: user.id,
      updatedBy: null,
      targets,
    });

    const batchIdsForEmit = await announcementRepo.resolveBatchIdsForEmit(businessId, {
      scope: created.scope,
      targetAllCourses: created.targetAllCourses,
      targetAllBatches: created.targetAllBatches,
      targets: created.targets.map((t) => ({ courseId: t.courseId, batchId: t.batchId })),
    });
    emitAnnouncementCreated(businessId, batchIdsForEmit, { id: created.id, businessId });

    logger.info(`[announcement] create success id=${created.id} userId=${user.id}`);
    return created;
  },

  async updateAnnouncement(user: IUser, id: number, dto: UpdateAnnouncementDto) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] update entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) {
      logger.warn(`[announcement] update not found id=${id} businessId=${businessId}`);
      throw new NotFoundError('Announcement');
    }

    if (user.role === UserRole.TEACHER) {
      if (existing.createdBy !== user.id) {
        throw new ForbiddenError('You can only edit your own announcements');
      }
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenError('Not allowed to update announcements');
    }

    const mergedScope = dto.scope ?? existing.scope;
    const mergedTargetAllCourses = dto.targetAllCourses ?? existing.targetAllCourses;
    const mergedTargetAllBatches = dto.targetAllBatches ?? existing.targetAllBatches;

    if (user.role === UserRole.TEACHER) {
      if (mergedScope !== AnnouncementScope.BATCH) {
        throw new BadRequestError('Teachers can only use batch-scoped announcements');
      }
    }

    const heading =
      dto.heading !== undefined ? dto.heading.trim() : existing.heading;
    const content =
      dto.content !== undefined ? dto.content.trim() : existing.content;
    if (!heading) throw new BadRequestError('heading is required');
    if (!content) throw new BadRequestError('content is required');
    if (heading.length > ANNOUNCEMENT_MAX_HEADING_LENGTH) {
      throw new BadRequestError(`heading must be at most ${ANNOUNCEMENT_MAX_HEADING_LENGTH} characters`);
    }
    if (content.length > ANNOUNCEMENT_MAX_CONTENT_LENGTH) {
      throw new BadRequestError(`content must be at most ${ANNOUNCEMENT_MAX_CONTENT_LENGTH} characters`);
    }

    const startDate =
      dto.startDate !== undefined ? parseIsoDate('startDate', dto.startDate) : existing.startDate;
    const endDate =
      dto.endDate !== undefined ? parseIsoDate('endDate', dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestError('endDate must be on or after startDate');
    }

    const visibleToAdmins = dto.visibleToAdmins ?? existing.visibleToAdmins;
    const visibleToTeachers = dto.visibleToTeachers ?? existing.visibleToTeachers;
    const visibleToStudents = dto.visibleToStudents ?? existing.visibleToStudents;
    assertAtLeastOneVisibility(visibleToAdmins, visibleToTeachers, visibleToStudents);

    if (user.role === UserRole.TEACHER && !visibleToStudents) {
      throw new BadRequestError('Teacher announcements must be visible to students');
    }

    const existingCourseIds = existing.targets
      .map((t) => t.courseId)
      .filter((c): c is number => c !== null && c !== undefined);
    const existingBatchIds = existing.targets
      .map((t) => t.batchId)
      .filter((b): b is number => b !== null && b !== undefined);

    const effectiveCourseIds =
      dto.courseIds !== undefined ? dto.courseIds : existingCourseIds;
    const effectiveBatchIds =
      dto.batchIds !== undefined ? dto.batchIds : existingBatchIds;

    const targetsTouched =
      dto.scope !== undefined ||
      dto.targetAllCourses !== undefined ||
      dto.targetAllBatches !== undefined ||
      dto.courseIds !== undefined ||
      dto.batchIds !== undefined;

    if (mergedScope === AnnouncementScope.COURSE && mergedTargetAllCourses && effectiveCourseIds.length > 0) {
      throw new BadRequestError('courseIds must be empty when targetAllCourses is true');
    }
    if (mergedScope === AnnouncementScope.BATCH && mergedTargetAllBatches && effectiveBatchIds.length > 0) {
      throw new BadRequestError('batchIds must be empty when targetAllBatches is true');
    }

    if (targetsTouched) {
      await validateTargetsBelongToBusiness(
        businessId,
        mergedScope,
        mergedTargetAllCourses,
        mergedTargetAllBatches,
        effectiveCourseIds,
        effectiveBatchIds,
      );
    }

    let targets: Array<{ courseId?: number | null; batchId?: number | null }> | undefined;
    if (targetsTouched) {
      targets = buildTargetsFromDto(
        {
          ...dto,
          scope: mergedScope,
          targetAllCourses: mergedTargetAllCourses,
          targetAllBatches: mergedTargetAllBatches,
          courseIds: effectiveCourseIds,
          batchIds: effectiveBatchIds,
        },
        {
          scope: mergedScope,
          targetAllCourses: mergedTargetAllCourses,
          targetAllBatches: mergedTargetAllBatches,
        },
      );

      if (user.role === UserRole.TEACHER) {
        if (mergedTargetAllBatches) {
          await assertTeacherTargetAllBatches(businessId, user.id);
        } else {
          const ids = targets.map((t) => t.batchId).filter((b): b is number => b !== null && b !== undefined);
          await assertTeacherOwnsBatches(businessId, user.id, ids);
        }
      }
    }

    try {
      const patch: AnnouncementUpdateRepoInput = {
        heading,
        content,
        startDate,
        endDate,
        isActive: dto.isActive ?? existing.isActive,
        visibleToAdmins,
        visibleToTeachers,
        visibleToStudents,
        updatedBy: user.id,
      };
      if (dto.scope !== undefined) patch.scope = dto.scope;
      if (dto.targetAllCourses !== undefined) patch.targetAllCourses = dto.targetAllCourses;
      if (dto.targetAllBatches !== undefined) patch.targetAllBatches = dto.targetAllBatches;
      if (targets !== undefined) patch.targets = targets;

      const updated = await announcementRepo.updateWithTargets(id, businessId, patch);

      const batchIdsForEmit = await announcementRepo.resolveBatchIdsForEmit(businessId, {
        scope: updated.scope,
        targetAllCourses: updated.targetAllCourses,
        targetAllBatches: updated.targetAllBatches,
        targets: updated.targets.map((t) => ({ courseId: t.courseId, batchId: t.batchId })),
      });
      emitAnnouncementUpdated(businessId, batchIdsForEmit, { id: updated.id, businessId });

      logger.info(`[announcement] update success id=${updated.id} userId=${user.id}`);
      return updated;
    } catch (e) {
      if (e instanceof Error && e.message === 'ANNOUNCEMENT_NOT_FOUND') {
        throw new NotFoundError('Announcement');
      }
      throw e;
    }
  },

  async deleteAnnouncement(user: IUser, id: number) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] delete entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) {
      throw new NotFoundError('Announcement');
    }

    if (user.role === UserRole.TEACHER) {
      if (existing.createdBy !== user.id) {
        throw new ForbiddenError('You can only delete your own announcements');
      }
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenError('Not allowed to delete announcements');
    }

    const batchIdsForEmit = await announcementRepo.resolveBatchIdsForEmit(businessId, {
      scope: existing.scope,
      targetAllCourses: existing.targetAllCourses,
      targetAllBatches: existing.targetAllBatches,
      targets: existing.targets.map((t) => ({ courseId: t.courseId, batchId: t.batchId })),
    });

    try {
      await announcementRepo.hardDeleteAnnouncement(id, businessId);
    } catch (e) {
      if (e instanceof Error && e.message === 'ANNOUNCEMENT_NOT_FOUND') {
        throw new NotFoundError('Announcement');
      }
      throw e;
    }

    emitAnnouncementDeleted(businessId, batchIdsForEmit, { id, businessId });
    logger.info(`[announcement] delete success id=${id} userId=${user.id}`);
  },
};
