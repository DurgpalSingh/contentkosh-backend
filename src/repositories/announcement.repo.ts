import {
  AnnouncementScope,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import {
  VISIBILITY_FIELD_ADMINS,
  VISIBILITY_FIELD_TEACHERS,
} from '../constants/announcement.constants';
import {
  findAllBatchIdsInBusiness,
  findBatchIdsForCourseIds,
  findUserBatchAndCourseMembership,
} from './batch.repo';

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

function activeDateWhere(): Prisma.AnnouncementWhereInput {
  const now = new Date();
  return {
    isActive: true,
    startDate: { lte: now },
    endDate: { gte: now },
  };
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
  visibilityField: 'visibleToAdmins' | 'visibleToTeachers' | 'visibleToStudents' | null,
): Promise<AnnouncementWithRelations[]> {
  if (!visibilityField) {
    return [];
  }

  const base: Prisma.AnnouncementWhereInput = {
    businessId,
    ...activeDateWhere(),
    [visibilityField]: true,
  };

  if (visibilityField === VISIBILITY_FIELD_ADMINS) {
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

function buildReceivedWhereForNonAdmin(
  businessId: number,
  userId: number,
  base: Prisma.AnnouncementWhereInput,
): Prisma.AnnouncementWhereInput {
  return {
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
}

const managedWhereByVisibility: Record<
  typeof VISIBILITY_FIELD_ADMINS | typeof VISIBILITY_FIELD_TEACHERS,
  (businessId: number, userId: number) => Prisma.AnnouncementWhereInput
> = {
  [VISIBILITY_FIELD_ADMINS]: (businessId) => ({ businessId }),
  [VISIBILITY_FIELD_TEACHERS]: (businessId, userId) => ({ businessId, createdBy: userId }),
};

export async function findUserAnnouncementBundle(
  businessId: number,
  userId: number,
  visibilityField: 'visibleToAdmins' | 'visibleToTeachers' | 'visibleToStudents' | null,
): Promise<{ received: AnnouncementWithRelations[]; managed: AnnouncementWithRelations[] }> {
  if (!visibilityField) {
    return { received: [], managed: [] };
  }

  const base: Prisma.AnnouncementWhereInput = {
    businessId,
    ...activeDateWhere(),
    [visibilityField]: true,
  };

  const orderBy: Prisma.AnnouncementOrderByWithRelationInput = { createdAt: 'desc' };

  const isAdmin = visibilityField === VISIBILITY_FIELD_ADMINS;
  const receivedWhere = isAdmin
    ? base
    : buildReceivedWhereForNonAdmin(businessId, userId, base);

  const managedWhereFn = managedWhereByVisibility[visibilityField as typeof VISIBILITY_FIELD_ADMINS | typeof VISIBILITY_FIELD_TEACHERS];

  if (!managedWhereFn) {
    const received = await prisma.announcement.findMany({
      where: receivedWhere,
      include: announcementListInclude,
      orderBy,
    });
    return { received, managed: [] };
  }

  const managedWhere = managedWhereFn(businessId, userId);

  const [received, managed] = await prisma.$transaction([
    prisma.announcement.findMany({ where: receivedWhere, include: announcementListInclude, orderBy }),
    prisma.announcement.findMany({ where: managedWhere, include: announcementListInclude, orderBy }),
  ]);

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
  heading: string;
  content: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  visibleToAdmins: boolean;
  visibleToTeachers: boolean;
  visibleToStudents: boolean;
  scope: AnnouncementScope;
  targetAllCourses: boolean;
  targetAllBatches: boolean;
  updatedBy: number | null;
  targets?: Array<{ courseId?: number | null; batchId?: number | null }> | undefined;
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

    const data: Prisma.AnnouncementUpdateInput = {
      heading: patch.heading,
      content: patch.content,
      startDate: patch.startDate,
      endDate: patch.endDate,
      isActive: patch.isActive,
      visibleToAdmins: patch.visibleToAdmins,
      visibleToTeachers: patch.visibleToTeachers,
      visibleToStudents: patch.visibleToStudents,
      scope: patch.scope,
      targetAllCourses: patch.targetAllCourses,
      targetAllBatches: patch.targetAllBatches,
      ...(patch.updatedBy !== null
        ? { updatedByUser: { connect: { id: patch.updatedBy } } }
        : {}),
    };

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
