import { AnnouncementScope, UserRole } from '@prisma/client';
import {
  VISIBILITY_FIELD_ADMINS,
  VISIBILITY_FIELD_STUDENTS,
  VISIBILITY_FIELD_TEACHERS,
} from '../constants/announcement.constants';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../dtos/announcement.dto';
import type { IUser } from '../dtos/auth.dto';
import { ForbiddenError } from '../errors/api.errors';
import * as announcementRepo from '../repositories/announcement.repo';
import type { AnnouncementUpdateRepoInput } from '../repositories/announcement.repo';
import {
  findActiveBatchIdsForUser,
  validateBatchIdsBelongToBusiness,
} from '../repositories/batch.repo';
import { validateCourseIdsBelongToBusiness } from '../repositories/course.repo';
import {
  emitAnnouncementCreated,
  emitAnnouncementDeleted,
  emitAnnouncementUpdated,
} from '../sockets/announcementEmitter';
import {
  makeAnnouncementTargets,
  normalizeAnnouncementTargets,
  validateAnnouncementDates,
  validateHeadingAndContent,
  validateTargetRequirements,
} from '../utils/announceUtils';
import logger from '../utils/logger';
import {
    parseIsoDate,
  requireBusinessId,
  throwBadRequest,
  throwForbidden,
  throwNotFound,
} from '../utils/commonUtils';

// ---------------------------------------------------------------------------
// Visibility field mapping
// ---------------------------------------------------------------------------

export type VisibilityField = typeof VISIBILITY_FIELD_ADMINS | typeof VISIBILITY_FIELD_TEACHERS | typeof VISIBILITY_FIELD_STUDENTS;

export function visibilityFieldForRole(role: UserRole): VisibilityField | null {
  if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) return VISIBILITY_FIELD_ADMINS;
  if (role === UserRole.TEACHER) return VISIBILITY_FIELD_TEACHERS;
  if (role === UserRole.STUDENT) return VISIBILITY_FIELD_STUDENTS;
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertAtLeastOneVisibility(
  visibleToAdmins: boolean,
  visibleToTeachers: boolean,
  visibleToStudents: boolean,
): void {
  if (!visibleToAdmins && !visibleToTeachers && !visibleToStudents) {
    throwBadRequest('At least one audience (admins, teachers, or students) must be selected');
  }
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
    const valid = await validateCourseIdsBelongToBusiness(businessId, courseIds);
    if (!valid) throwBadRequest('One or more courses are invalid for this business');
  }
  if (scope === AnnouncementScope.BATCH && !targetAllBatches) {
    const valid = await validateBatchIdsBelongToBusiness(businessId, batchIds);
    if (!valid) throwBadRequest('One or more batches are invalid for this business');
  }
}

async function assertTeacherOwnsBatches(
  businessId: number,
  userId: number,
  batchIds: number[],
): Promise<void> {
  if (batchIds.length === 0) return;
  const allowedBatchIds = new Set(await findActiveBatchIdsForUser(businessId, userId));
  for (const batchId of batchIds) {
    if (!allowedBatchIds.has(batchId)) {
      logger.warn(`[announcement] teacher batch denied userId=${userId} batchId=${batchId}`);
      throw new ForbiddenError(`You can only target batches you belong to (role: ${UserRole.TEACHER})`);
    }
  }
}

async function assertTeacherTargetAllBatches(businessId: number, userId: number): Promise<void> {
  const count = (await findActiveBatchIdsForUser(businessId, userId)).length;
  if (count === 0) {
    throwBadRequest('You must belong to at least one batch to create announcements');
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

  if (scope !== AnnouncementScope.BATCH) throwBadRequest('Teachers can only use batch-scoped announcements');
  if (!visibleToStudents) throwBadRequest('Teacher announcements must be visible to students');
  if (targetAllCourses) throwBadRequest('Invalid target flags for teacher announcement');

  if (targetAllBatches) {
    await assertTeacherTargetAllBatches(businessId, userId);
  } else {
    await assertTeacherOwnsBatches(businessId, userId, batchIds);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const announcementService = {
  async getMyAnnouncements(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getMyAnnouncements userId=${user.id} role=${user.role} businessId=${businessId}`);
    const visibilityField = visibilityFieldForRole(user.role);
    const announcements = await announcementRepo.findMyAnnouncements(businessId, user.id, visibilityField);
    logger.info(`[announcement] getMyAnnouncements count=${announcements.length}`);
    return announcements;
  },

  async getUserAnnouncementBundle(user: IUser) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] getUserAnnouncementBundle userId=${user.id} role=${user.role} businessId=${businessId}`);
    const visibilityField = visibilityFieldForRole(user.role);
    const { received, managed } = await announcementRepo.findUserAnnouncementBundle(
      businessId,
      user.id,
      visibilityField,
    );
    logger.info(`[announcement] getUserAnnouncementBundle received=${received.length} managed=${managed.length}`);
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

    throwForbidden('Not allowed to list managed announcements', user.role);
  },

  async createAnnouncement(user: IUser, dto: CreateAnnouncementDto) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] create entry userId=${user.id} role=${user.role} businessId=${businessId} scope=${dto.scope}`);

    const canCreate =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPERADMIN ||
      user.role === UserRole.TEACHER;
    if (!canCreate) throwForbidden('Not allowed to create announcements', user.role);

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
      scope: targetSettings.scope,
      targetAllCourses: targetSettings.targetAllCourses,
      targetAllBatches: targetSettings.targetAllBatches,
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
    const isTeacher = user.role === UserRole.TEACHER;
    const isAdminOrSuperAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

    logger.info(`[announcement] update entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) {
      logger.warn(`[announcement] update not found id=${id} businessId=${businessId}`);
      throwNotFound('Announcement');
    }

    if (isTeacher) {
      if (existing.createdBy !== user.id) throwForbidden('You can only edit your own announcements', user.role);
    } else if (!isAdminOrSuperAdmin) {
      throwForbidden('Not allowed to update announcements', user.role);
    }

    const existingCourseIds = existing.targets
      .map((t) => t.courseId)
      .filter((c): c is number => c !== null);
    const existingBatchIds = existing.targets
      .map((t) => t.batchId)
      .filter((b): b is number => b !== null);

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

    const startDate = dto.startDate !== undefined ? parseIsoDate('startDate', dto.startDate) : existing.startDate;
    const endDate = dto.endDate !== undefined ? parseIsoDate('endDate', dto.endDate) : existing.endDate;
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

    // Build a fully-resolved patch — all scalar fields are always set so the
    // repo no longer needs to guard each one with `!== undefined`.
    const patch: AnnouncementUpdateRepoInput = {
      heading,
      content,
      startDate,
      endDate,
      isActive: dto.isActive ?? existing.isActive,
      visibleToAdmins,
      visibleToTeachers,
      visibleToStudents,
      scope: targetSettings.scope,
      targetAllCourses: targetSettings.targetAllCourses,
      targetAllBatches: targetSettings.targetAllBatches,
      updatedBy: user.id,
      targets,
    };

    try {
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
      if (e instanceof Error && e.message === 'ANNOUNCEMENT_NOT_FOUND') throwNotFound('Announcement');
      throw e;
    }
  },

  async deleteAnnouncement(user: IUser, id: number) {
    const businessId = requireBusinessId(user);
    logger.info(`[announcement] delete entry id=${id} userId=${user.id} role=${user.role} businessId=${businessId}`);

    const existing = await announcementRepo.findAnnouncementByIdWithTargets(id, businessId);
    if (!existing) throwNotFound('Announcement');

    if (user.role === UserRole.TEACHER) {
      if (existing.createdBy !== user.id) throwForbidden('You can only delete your own announcements', user.role);
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throwForbidden('Not allowed to delete announcements', user.role);
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
      if (e instanceof Error && e.message === 'ANNOUNCEMENT_NOT_FOUND') throwNotFound('Announcement');
      throw e;
    }

    emitAnnouncementDeleted(businessId, batchIdsForEmit, { id, businessId });
    logger.info(`[announcement] delete success id=${id} userId=${user.id}`);
  },
};
