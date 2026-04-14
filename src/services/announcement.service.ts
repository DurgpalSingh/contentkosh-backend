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
    throwForbidden('Business context required');
  }
  return user.businessId;
}

function throwBadRequest(message: string): never {
  logger.warn(`[announcement] bad request: ${message}`);
  throw new BadRequestError(message);
}

function throwForbidden(message: string): never {
  logger.warn(`[announcement] forbidden: ${message}`);
  throw new ForbiddenError(message);
}

function throwNotFound(resource: string): never {
  logger.warn(`[announcement] not found: ${resource}`);
  throw new NotFoundError(resource);
}

function parseIsoDate(label: string, value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throwBadRequest(`Invalid ${label}`);
  }
  return d;
}

function assertAtLeastOneVisibility(
  visibleToAdmins: boolean,
  visibleToTeachers: boolean,
  visibleToStudents: boolean,
): void {
  if (!visibleToAdmins && !visibleToTeachers && !visibleToStudents) {
    throwBadRequest('At least one audience (admins, teachers, or students) must be selected');
  }
}

function normalizeAnnouncementTargets(
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
    throwBadRequest('scope is required');
  }

  return {
    scope,
    targetAllCourses: dto.targetAllCourses ?? existingTargets?.targetAllCourses ?? false,
    targetAllBatches: dto.targetAllBatches ?? existingTargets?.targetAllBatches ?? false,
    courseIds: dto.courseIds ?? existingTargets?.courseIds ?? [],
    batchIds: dto.batchIds ?? existingTargets?.batchIds ?? [],
  };
}

function validateHeadingAndContent(heading: string, content: string): void {
  const checks = [
    { condition: !heading, message: 'heading is required' },
    { condition: !content, message: 'content is required' },
    {
      condition: heading.length > ANNOUNCEMENT_MAX_HEADING_LENGTH,
      message: `heading must be at most ${ANNOUNCEMENT_MAX_HEADING_LENGTH} characters`,
    },
    {
      condition: content.length > ANNOUNCEMENT_MAX_CONTENT_LENGTH,
      message: `content must be at most ${ANNOUNCEMENT_MAX_CONTENT_LENGTH} characters`,
    },
  ];

  checks.forEach(({ condition, message }) => {
    if (condition) throwBadRequest(message);
  });
}

function validateAnnouncementDates(startDate: Date, endDate: Date): void {
  if (endDate < startDate) {
    throwBadRequest('endDate must be on or after startDate');
  }
}

function makeAnnouncementTargets(
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

function validateTargetRequirements(
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  courseIds: number[],
  batchIds: number[],
): void {
  const checks = [
    {
      condition: scope === AnnouncementScope.COURSE && targetAllCourses && courseIds.length > 0,
      message: 'courseIds must be empty when targetAllCourses is true',
    },
    {
      condition: scope === AnnouncementScope.COURSE && !targetAllCourses && courseIds.length === 0,
      message: 'courseIds required when scope is COURSE and targetAllCourses is false',
    },
    {
      condition: scope === AnnouncementScope.BATCH && targetAllBatches && batchIds.length > 0,
      message: 'batchIds must be empty when targetAllBatches is true',
    },
    {
      condition: scope === AnnouncementScope.BATCH && !targetAllBatches && batchIds.length === 0,
      message: 'batchIds required when scope is BATCH and targetAllBatches is false',
    },
  ];

  checks.forEach(({ condition, message }) => {
    if (condition) throwBadRequest(message);
  });
}

async function validateTargetsBelongToBusiness(
  businessId: number,
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  courseIds: number[],
  batchIds: number[],
): Promise<void> {
  const validations = [
    {
      condition: scope === AnnouncementScope.COURSE && !targetAllCourses,
      validator: () => announcementRepo.validateCourseIdsBelongToBusiness(businessId, courseIds),
      errorMessage: 'One or more courses are invalid for this business',
    },
    {
      condition: scope === AnnouncementScope.BATCH && !targetAllBatches,
      validator: () => announcementRepo.validateBatchIdsBelongToBusiness(businessId, batchIds),
      errorMessage: 'One or more batches are invalid for this business',
    },
  ];

  for (const validation of validations) {
    if (!validation.condition) continue;
    const isValid = await validation.validator();
    if (!isValid) {
      throwBadRequest(validation.errorMessage);
    }
  }
}

async function assertTeacherAnnouncementPermissions(
  businessId: number,
  userId: number,
  role: UserRole,
  scope: AnnouncementScope,
  targetAllCourses: boolean,
  targetAllBatches: boolean,
  batchIds: number[],
  visibleToStudents: boolean,
): Promise<void> {
  if (role !== UserRole.TEACHER) return;

  const validationRules = [
    {
      condition: scope !== AnnouncementScope.BATCH,
      message: 'Teachers can only use batch-scoped announcements',
    },
    {
      condition: !visibleToStudents,
      message: 'Teacher announcements must be visible to students',
    },
    {
      condition: targetAllCourses,
      message: 'Invalid target flags for teacher announcement',
    },
  ];

  validationRules.forEach(({ condition, message }) => {
    if (condition) throwBadRequest(message);
  });

  if (targetAllBatches) {
    await assertTeacherTargetAllBatches(businessId, userId);
  } else {
    await assertTeacherOwnsBatches(businessId, userId, batchIds);
  }
}

async function assertTeacherOwnsBatches(
  businessId: number,
  userId: number,
  batchIds: number[],
): Promise<void> {
  if (batchIds.length === 0) return;
  const allowedBatchIds = new Set(await announcementRepo.findActiveBatchIdsForUser(businessId, userId));
  for (const batchId of batchIds) {
    if (!allowedBatchIds.has(batchId)) {
      logger.warn(
        `[announcement] teacher batch denied userId=${userId} batchId=${batchId}`,
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
    throwBadRequest('You must belong to at least one batch to create announcements');
  }
}

export const announcementService = {
  async getMyAnnouncements(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getMyAnnouncements userId=${user.id} role=${user.role} businessId=${businessId}`);
    const announcements = await announcementRepo.findMyAnnouncements(businessId, user.id, user.role);
    logger.info(`[announcement] getMyAnnouncements count=${announcements.length}`);
    return announcements;
  },

  async getUserAnnouncementBundle(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(
      `[announcement] getUserAnnouncementBundle userId=${user.id} role=${user.role} businessId=${businessId}`,
    );

    const { received, managed } = await announcementRepo.findUserAnnouncementBundle(
      businessId,
      user.id,
      user.role,
    );

    logger.info(
      `[announcement] getUserAnnouncementBundle received=${received.length} managed=${managed.length}`,
    );

    return { received, managed };
  },

  async getManagedAnnouncements(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getManagedAnnouncements userId=${user.id} role=${user.role} businessId=${businessId}`);

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
      const announcements = await announcementRepo.findAllForBusinessAdmin(businessId);
      logger.info(`[announcement] getManagedAnnouncements admin count=${announcements.length}`);
      return announcements;
    }

    if (user.role === UserRole.TEACHER) {
      const announcements = await announcementRepo.findCreatedByUser(businessId, user.id);
      logger.info(`[announcement] getManagedAnnouncements teacher count=${announcements.length}`);
      return announcements;
    }

    throwForbidden('Not allowed to list managed announcements');
  },

  async createAnnouncement(user: IUser, dto: CreateAnnouncementDto) {
    const businessId = requireBusinessId(user);
    const isTeacher = user.role === UserRole.TEACHER;
    const canManageAnnouncements =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPERADMIN ||
      isTeacher;

    logger.info(
      `[announcement] create entry userId=${user.id} role=${user.role} businessId=${businessId} scope=${dto.scope}`,
    );

    if (!canManageAnnouncements) {
      throwForbidden('Not allowed to create announcements');
    }

    const heading = dto.heading?.trim() ?? '';
    const content = dto.content?.trim() ?? '';
    validateHeadingAndContent(heading, content);

    const startDate = parseIsoDate('startDate', dto.startDate);
    const endDate = parseIsoDate('endDate', dto.endDate);
    validateAnnouncementDates(startDate, endDate);

    const visibleToAdmins = dto.visibleToAdmins ?? false;
    const visibleToTeachers = dto.visibleToTeachers ?? false;
    const visibleToStudents = dto.visibleToStudents ?? false;
    assertAtLeastOneVisibility(visibleToAdmins, visibleToTeachers, visibleToStudents);

    const targetSettings = normalizeAnnouncementTargets(dto);
    validateTargetRequirements(
      targetSettings.scope,
      targetSettings.targetAllCourses,
      targetSettings.targetAllBatches,
      targetSettings.courseIds,
      targetSettings.batchIds,
    );

    await assertTeacherAnnouncementPermissions(
      businessId,
      user.id,
      user.role,
      targetSettings.scope,
      targetSettings.targetAllCourses,
      targetSettings.targetAllBatches,
      targetSettings.batchIds,
      visibleToStudents,
    );

    await validateTargetsBelongToBusiness(
      businessId,
      targetSettings.scope,
      targetSettings.targetAllCourses,
      targetSettings.targetAllBatches,
      targetSettings.courseIds,
      targetSettings.batchIds,
    );

    const targets = makeAnnouncementTargets(
      targetSettings.scope,
      targetSettings.targetAllCourses,
      targetSettings.targetAllBatches,
      targetSettings.courseIds,
      targetSettings.batchIds,
    );

    const createdAnnouncement = await announcementRepo.createWithTargets({
      heading,
      content,
      startDate,
      endDate,
      isActive: dto.isActive ?? true,
      businessId,
      visibleToAdmins,
      visibleToTeachers,
      visibleToStudents,
      scope: targetSettings.scope,
      targetAllCourses: targetSettings.targetAllCourses,
      targetAllBatches: targetSettings.targetAllBatches,
      createdBy: user.id,
      updatedBy: null,
      targets,
    });

    const batchIdsForEmit = await announcementRepo.resolveBatchIdsForEmit(businessId, {
      scope: createdAnnouncement.scope,
      targetAllCourses: createdAnnouncement.targetAllCourses,
      targetAllBatches: createdAnnouncement.targetAllBatches,
      targets: createdAnnouncement.targets.map((t) => ({ courseId: t.courseId, batchId: t.batchId })),
    });
    emitAnnouncementCreated(businessId, batchIdsForEmit, { id: createdAnnouncement.id, businessId });

    logger.info(`[announcement] create success id=${createdAnnouncement.id} userId=${user.id}`);
    return createdAnnouncement;
  },

  async updateAnnouncement(user: IUser, id: number, dto: UpdateAnnouncementDto) {
    const businessId = requireBusinessId(user);
    const isTeacher = user.role === UserRole.TEACHER;
    const isAdminOrSuperAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

    logger.info(`[announcement] update entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) {
      logger.warn(`[announcement] update not found id=${id} businessId=${businessId}`);
      throwNotFound('Announcement');
    }

    if (isTeacher) {
      if (existing.createdBy !== user.id) {
        throwForbidden('You can only edit your own announcements');
      }
    } else if (!isAdminOrSuperAdmin) {
      throwForbidden('Not allowed to update announcements');
    }

    const existingCourseIds = existing.targets
      .map((t) => t.courseId)
      .filter((c): c is number => c !== null && c !== undefined);
    const existingBatchIds = existing.targets
      .map((t) => t.batchId)
      .filter((b): b is number => b !== null && b !== undefined);

    const targetSettings = normalizeAnnouncementTargets(dto, {
      scope: existing.scope,
      targetAllCourses: existing.targetAllCourses,
      targetAllBatches: existing.targetAllBatches,
      courseIds: existingCourseIds,
      batchIds: existingBatchIds,
    });

    if (isTeacher && targetSettings.scope !== AnnouncementScope.BATCH) {
      throwBadRequest('Teachers can only use batch-scoped announcements');
    }

    const heading = dto.heading !== undefined ? dto.heading.trim() : existing.heading;
    const content = dto.content !== undefined ? dto.content.trim() : existing.content;
    validateHeadingAndContent(heading, content);

    const startDate =
      dto.startDate !== undefined ? parseIsoDate('startDate', dto.startDate) : existing.startDate;
    const endDate =
      dto.endDate !== undefined ? parseIsoDate('endDate', dto.endDate) : existing.endDate;
    validateAnnouncementDates(startDate, endDate);

    const visibleToAdmins = dto.visibleToAdmins ?? existing.visibleToAdmins;
    const visibleToTeachers = dto.visibleToTeachers ?? existing.visibleToTeachers;
    const visibleToStudents = dto.visibleToStudents ?? existing.visibleToStudents;
    assertAtLeastOneVisibility(visibleToAdmins, visibleToTeachers, visibleToStudents);

    if (isTeacher && !visibleToStudents) {
      throwBadRequest('Teacher announcements must be visible to students');
    }

    const targetsUpdated =
      dto.scope !== undefined ||
      dto.targetAllCourses !== undefined ||
      dto.targetAllBatches !== undefined ||
      dto.courseIds !== undefined ||
      dto.batchIds !== undefined;

    validateTargetRequirements(
      targetSettings.scope,
      targetSettings.targetAllCourses,
      targetSettings.targetAllBatches,
      targetSettings.courseIds,
      targetSettings.batchIds,
    );

    if (targetsUpdated) {
      await validateTargetsBelongToBusiness(
        businessId,
        targetSettings.scope,
        targetSettings.targetAllCourses,
        targetSettings.targetAllBatches,
        targetSettings.courseIds,
        targetSettings.batchIds,
      );
    }

    let targets: Array<{ courseId?: number | null; batchId?: number | null }> | undefined;
    if (targetsUpdated) {
      targets = makeAnnouncementTargets(
        targetSettings.scope,
        targetSettings.targetAllCourses,
        targetSettings.targetAllBatches,
        targetSettings.courseIds,
        targetSettings.batchIds,
      );

      await assertTeacherAnnouncementPermissions(
        businessId,
        user.id,
        user.role,
        targetSettings.scope,
        targetSettings.targetAllCourses,
        targetSettings.targetAllBatches,
        targetSettings.batchIds,
        visibleToStudents,
      );
    }

    try {
      const updatePayload: AnnouncementUpdateRepoInput = {
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
      if (dto.scope !== undefined) updatePayload.scope = dto.scope;
      if (dto.targetAllCourses !== undefined) updatePayload.targetAllCourses = dto.targetAllCourses;
      if (dto.targetAllBatches !== undefined) updatePayload.targetAllBatches = dto.targetAllBatches;
      if (targets !== undefined) updatePayload.targets = targets;

      const updatedAnnouncement = await announcementRepo.updateWithTargets(id, businessId, updatePayload);

      const batchIdsForEmit = await announcementRepo.resolveBatchIdsForEmit(businessId, {
        scope: updatedAnnouncement.scope,
        targetAllCourses: updatedAnnouncement.targetAllCourses,
        targetAllBatches: updatedAnnouncement.targetAllBatches,
        targets: updatedAnnouncement.targets.map((t) => ({ courseId: t.courseId, batchId: t.batchId })),
      });
      emitAnnouncementUpdated(businessId, batchIdsForEmit, { id: updatedAnnouncement.id, businessId });

      logger.info(`[announcement] update success id=${updatedAnnouncement.id} userId=${user.id}`);
      return updatedAnnouncement;
    } catch (e) {
      if (e instanceof Error && e.message === 'ANNOUNCEMENT_NOT_FOUND') {
        throwNotFound('Announcement');
      }
      throw e;
    }
  },

  async deleteAnnouncement(user: IUser, id: number) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] delete entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) {
      throwNotFound('Announcement');
    }

    if (user.role === UserRole.TEACHER) {
      if (existing.createdBy !== user.id) {
        throwForbidden('You can only delete your own announcements');
      }
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throwForbidden('Not allowed to delete announcements');
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
        throwNotFound('Announcement');
      }
      throw e;
    }

    emitAnnouncementDeleted(businessId, batchIdsForEmit, { id, businessId });
    logger.info(`[announcement] delete success id=${id} userId=${user.id}`);
  },
};
