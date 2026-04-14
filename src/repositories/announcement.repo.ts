import {
  AnnouncementScope,
  Prisma,
  UserRole,
} from '@prisma/client';
import { prisma } from '../config/database';

const creatorSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export const announcementListInclude = {
  targets: true,
  createdByUser: { select: creatorSelect },
} as const;

export type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{
  include: typeof announcementListInclude;
}>;

const announcementBaseSelect = {
  id: true,
  heading: true,
  content: true,
  startDate: true,
  endDate: true,
  isActive: true,
  businessId: true,
  visibleToAdmins: true,
  visibleToTeachers: true,
  visibleToStudents: true,
  scope: true,
  targetAllCourses: true,
  targetAllBatches: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findAnnouncementByIdWithTargets(
  id: number,
  businessId: number,
): Promise<AnnouncementWithRelations | null> {
  return prisma.announcement.findFirst({
    where: { id, businessId },
    include: announcementListInclude,
  });
}

export async function findAnnouncementByIdWithTargetsAnyBusiness(
  id: number,
): Promise<AnnouncementWithRelations | null> {
  return prisma.announcement.findUnique({
    where: { id },
    include: announcementListInclude,
  });
}

export async function findActiveBatchIdsForUser(
  businessId: number,
  userId: number,
): Promise<number[]> {
  const rows = await prisma.batchUser.findMany({
    where: {
      userId,
      isActive: true,
      batch: {
        course: {
          exam: { businessId },
        },
      },
    },
    select: { batchId: true },
  });
  return [...new Set(rows.map((r) => r.batchId))];
}

export async function findUserBatchAndCourseMembership(
  businessId: number,
  userId: number,
): Promise<{ batchIds: number[]; courseIds: number[] }> {
  const rows = await prisma.batchUser.findMany({
    where: {
      userId,
      isActive: true,
      batch: {
        course: {
          exam: { businessId },
        },
      },
    },
    select: {
      batchId: true,
      batch: { select: { courseId: true } },
    },
  });
  const batchIds = [...new Set(rows.map((r) => r.batchId))];
  const courseIds = [...new Set(rows.map((r) => r.batch.courseId))];
  return { batchIds, courseIds };
}

export async function findAllBatchIdsInBusiness(businessId: number): Promise<number[]> {
  const rows = await prisma.batch.findMany({
    where: {
      course: {
        exam: { businessId },
      },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function findBatchIdsForCourseIds(
  businessId: number,
  courseIds: number[],
): Promise<number[]> {
  if (courseIds.length === 0) return [];
  const rows = await prisma.batch.findMany({
    where: {
      courseId: { in: courseIds },
      course: { exam: { businessId } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function validateCourseIdsBelongToBusiness(
  businessId: number,
  courseIds: number[],
): Promise<boolean> {
  if (courseIds.length === 0) return true;
  const count = await prisma.course.count({
    where: {
      id: { in: courseIds },
      exam: { businessId },
    },
  });
  return count === courseIds.length;
}

export async function validateBatchIdsBelongToBusiness(
  businessId: number,
  batchIds: number[],
): Promise<boolean> {
  if (batchIds.length === 0) return true;
  const count = await prisma.batch.count({
    where: {
      id: { in: batchIds },
      course: { exam: { businessId } },
    },
  });
  return count === batchIds.length;
}

function activeDateWhere(): Prisma.AnnouncementWhereInput {
  const now = new Date();
  return {
    isActive: true,
    startDate: { lte: now },
    endDate: { gte: now },
  };
}

function visibilityFieldForRole(
  role: UserRole,
): 'visibleToAdmins' | 'visibleToTeachers' | 'visibleToStudents' | null {
  if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) return 'visibleToAdmins';
  if (role === UserRole.TEACHER) return 'visibleToTeachers';
  if (role === UserRole.STUDENT) return 'visibleToStudents';
  return null;
}

function buildTargetOrForTeacherOrStudent(
  batchIds: number[],
  courseIds: number[],
): Prisma.AnnouncementWhereInput[] {
  const or: Prisma.AnnouncementWhereInput[] = [
    { scope: AnnouncementScope.COURSE, targetAllCourses: true },
    { scope: AnnouncementScope.BATCH, targetAllBatches: true },
  ];
  if (courseIds.length > 0) {
    or.push({
      scope: AnnouncementScope.COURSE,
      targetAllCourses: false,
      targets: { some: { courseId: { in: courseIds } } },
    });
  }
  if (batchIds.length > 0) {
    or.push({
      scope: AnnouncementScope.BATCH,
      targetAllBatches: false,
      targets: { some: { batchId: { in: batchIds } } },
    });
  }
  return or;
}

export async function findMyAnnouncements(
  businessId: number,
  userId: number,
  role: UserRole,
): Promise<AnnouncementWithRelations[]> {
  const visibilityField = visibilityFieldForRole(role);
  if (!visibilityField) {
    return [];
  }

  const base: Prisma.AnnouncementWhereInput = {
    businessId,
    ...activeDateWhere(),
    [visibilityField]: true,
  };

  if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) {
    return prisma.announcement.findMany({
      where: base,
      include: announcementListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  const { batchIds, courseIds } = await findUserBatchAndCourseMembership(businessId, userId);
  const targetOr = buildTargetOrForTeacherOrStudent(batchIds, courseIds);

  return prisma.announcement.findMany({
    where: {
      ...base,
      OR: targetOr,
    },
    include: announcementListInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findAllForBusinessAdmin(
  businessId: number,
): Promise<AnnouncementWithRelations[]> {
  return prisma.announcement.findMany({
    where: { businessId },
    include: announcementListInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findCreatedByUser(
  businessId: number,
  userId: number,
): Promise<AnnouncementWithRelations[]> {
  return prisma.announcement.findMany({
    where: { businessId, createdBy: userId },
    include: announcementListInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findUserAnnouncementBundle(
  businessId: number,
  userId: number,
  role: UserRole,
): Promise<{ received: AnnouncementWithRelations[]; managed: AnnouncementWithRelations[] }> {
  const visibilityField = visibilityFieldForRole(role);
  if (!visibilityField) {
    return { received: [], managed: [] };
  }

  const isAdminOrSuperAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  const isTeacher = role === UserRole.TEACHER;

  const base: Prisma.AnnouncementWhereInput = {
    businessId,
    ...activeDateWhere(),
    [visibilityField]: true,
  };

  const orderBy: Prisma.AnnouncementOrderByWithRelationInput = { createdAt: 'desc' };

  const receivedWhere: Prisma.AnnouncementWhereInput = isAdminOrSuperAdmin
    ? base
    : {
        ...base,
        OR: [
          { scope: AnnouncementScope.COURSE, targetAllCourses: true },
          { scope: AnnouncementScope.BATCH, targetAllBatches: true },
          {
            scope: AnnouncementScope.COURSE,
            targetAllCourses: false,
            targets: {
              some: {
                course: {
                  exam: { businessId },
                  batches: {
                    some: {
                      batchUsers: { some: { userId, isActive: true } },
                    },
                  },
                },
              },
            },
          },
          {
            scope: AnnouncementScope.BATCH,
            targetAllBatches: false,
            targets: {
              some: {
                batch: {
                  course: { exam: { businessId } },
                  batchUsers: { some: { userId, isActive: true } },
                },
              },
            },
          },
        ],
      };

  const managedWhere: Prisma.AnnouncementWhereInput | null = isAdminOrSuperAdmin
    ? { businessId }
    : isTeacher
      ? { businessId, createdBy: userId }
      : null;

  const receivedQuery = prisma.announcement.findMany({
    where: receivedWhere,
    include: announcementListInclude,
    orderBy,
  });

  if (!managedWhere) {
    const received = await receivedQuery;
    return { received, managed: [] };
  }

  const managedQuery = prisma.announcement.findMany({
    where: managedWhere,
    include: announcementListInclude,
    orderBy,
  });

  const [received, managed] = await prisma.$transaction([receivedQuery, managedQuery]);
  return { received, managed };
}

export interface AnnouncementCreateRepoInput {
  heading: string;
  content: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  businessId: number;
  visibleToAdmins: boolean;
  visibleToTeachers: boolean;
  visibleToStudents: boolean;
  scope: AnnouncementScope;
  targetAllCourses: boolean;
  targetAllBatches: boolean;
  createdBy: number;
  updatedBy: number | null;
  targets: Array<{ courseId?: number | null; batchId?: number | null }>;
}

export async function createWithTargets(
  input: AnnouncementCreateRepoInput,
): Promise<AnnouncementWithRelations> {
  const { targets, ...rest } = input;
  return prisma.$transaction(async (tx) => {
    const created = await tx.announcement.create({
      data: {
        heading: rest.heading,
        content: rest.content,
        startDate: rest.startDate,
        endDate: rest.endDate,
        isActive: rest.isActive,
        business: { connect: { id: rest.businessId } },
        visibleToAdmins: rest.visibleToAdmins,
        visibleToTeachers: rest.visibleToTeachers,
        visibleToStudents: rest.visibleToStudents,
        scope: rest.scope,
        targetAllCourses: rest.targetAllCourses,
        targetAllBatches: rest.targetAllBatches,
        createdByUser: { connect: { id: rest.createdBy } },
        ...(rest.updatedBy !== null && rest.updatedBy !== undefined
          ? { updatedByUser: { connect: { id: rest.updatedBy } } }
          : {}),
        targets: {
          create: targets.map((t) => ({
            courseId: t.courseId ?? null,
            batchId: t.batchId ?? null,
          })),
        },
      },
      include: announcementListInclude,
    });
    return created;
  });
}

export interface AnnouncementUpdateRepoInput {
  heading?: string;
  content?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  visibleToAdmins?: boolean;
  visibleToTeachers?: boolean;
  visibleToStudents?: boolean;
  scope?: AnnouncementScope;
  targetAllCourses?: boolean;
  targetAllBatches?: boolean;
  updatedBy: number | null;
  targets?: Array<{ courseId?: number | null; batchId?: number | null }>;
}

export async function updateWithTargets(
  id: number,
  businessId: number,
  patch: AnnouncementUpdateRepoInput,
): Promise<AnnouncementWithRelations> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.announcement.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      throw new Error('ANNOUNCEMENT_NOT_FOUND');
    }

    const data: Prisma.AnnouncementUpdateInput = {};
    if (patch.heading !== undefined) data.heading = patch.heading;
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.startDate !== undefined) data.startDate = patch.startDate;
    if (patch.endDate !== undefined) data.endDate = patch.endDate;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.visibleToAdmins !== undefined) data.visibleToAdmins = patch.visibleToAdmins;
    if (patch.visibleToTeachers !== undefined) data.visibleToTeachers = patch.visibleToTeachers;
    if (patch.visibleToStudents !== undefined) data.visibleToStudents = patch.visibleToStudents;
    if (patch.scope !== undefined) data.scope = patch.scope;
    if (patch.targetAllCourses !== undefined) data.targetAllCourses = patch.targetAllCourses;
    if (patch.targetAllBatches !== undefined) data.targetAllBatches = patch.targetAllBatches;
    if (patch.updatedBy !== null && patch.updatedBy !== undefined) {
      data.updatedByUser = { connect: { id: patch.updatedBy } };
    }

    if (patch.targets !== undefined) {
      await tx.announcementTarget.deleteMany({ where: { announcementId: id } });
      data.targets = {
        create: patch.targets.map((t) => ({
          courseId: t.courseId ?? null,
          batchId: t.batchId ?? null,
        })),
      };
    }

    return tx.announcement.update({
      where: { id },
      data,
      include: announcementListInclude,
    });
  });
}

export async function hardDeleteAnnouncement(id: number, businessId: number): Promise<void> {
  const result = await prisma.announcement.deleteMany({
    where: { id, businessId },
  });
  if (result.count === 0) {
    throw new Error('ANNOUNCEMENT_NOT_FOUND');
  }
}

/**
 * Batch IDs that should receive socket events for this announcement payload.
 */
export async function resolveBatchIdsForEmit(
  businessId: number,
  row: {
    scope: AnnouncementScope;
    targetAllCourses: boolean;
    targetAllBatches: boolean;
    targets: Array<{ courseId: number | null; batchId: number | null }>;
  },
): Promise<number[]> {
  if (row.scope === AnnouncementScope.COURSE) {
    if (row.targetAllCourses) {
      return findAllBatchIdsInBusiness(businessId);
    }
    const courseIds = row.targets
      .map((t) => t.courseId)
      .filter((id): id is number => id !== null && id !== undefined);
    return findBatchIdsForCourseIds(businessId, courseIds);
  }

  if (row.scope === AnnouncementScope.BATCH) {
    if (row.targetAllBatches) {
      return findAllBatchIdsInBusiness(businessId);
    }
    return row.targets
      .map((t) => t.batchId)
      .filter((id): id is number => id !== null && id !== undefined);
  }

  return [];
}
