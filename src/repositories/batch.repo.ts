import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { queryTenantPublic, userBasicFromRow } from './crossSchema.repo';
import {
  ACTIVE_BATCH_WHERE,
  activeBatchWhereForBusiness,
  activeCourseWhereForBusiness,
} from '../constants/hierarchyFilters';

const batchSelect = {
  id: true,
  codeName: true,
  displayName: true,
  startDate: true,
  endDate: true,
  isActive: true,
  courseId: true,
  createdAt: true,
  updatedAt: true,
};

const courseSelect = {
  id: true,
  name: true,
  examId: true,
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  profilePicture: true,
};

function mapBatchUserRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    batchId: row.batch_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: userBasicFromRow(row, 'user'),
    ...(row.batch_code_name !== undefined
      ? {
          batch: {
            id: row.batch_id,
            codeName: row.batch_code_name,
            displayName: row.batch_display_name,
            startDate: row.batch_start_date,
            endDate: row.batch_end_date,
            isActive: row.batch_is_active,
            courseId: row.batch_course_id,
            createdAt: row.batch_created_at,
            updatedAt: row.batch_updated_at,
          },
        }
      : {}),
  };
}

async function findBatchBusinessIdRequired(batchId: number): Promise<number> {
  const businessId = await findBatchBusinessId(batchId);
  if (!businessId) throw new Error(`Business not found for batch ${batchId}`);
  return businessId;
}

async function findCourseBusinessId(courseId: number): Promise<number | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { exam: { select: { businessId: true } } },
  });
  return course?.exam?.businessId ?? null;
}

async function findBatchUsersJoined(
  businessId: number,
  whereSql: string,
  params: unknown[],
  includeBatch = false,
) {
  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      SELECT
        bu.*,
        u.id AS user_id, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
        u.role AS user_role, u.profile_picture AS user_profile_picture
        ${includeBatch ? `,
        b.code_name AS batch_code_name, b.display_name AS batch_display_name,
        b.start_date AS batch_start_date, b.end_date AS batch_end_date,
        b.is_active AS batch_is_active, b.course_id AS batch_course_id,
        b.created_at AS batch_created_at, b.updated_at AS batch_updated_at` : ''}
      FROM ${schema}.batch_users bu
      JOIN public.users u ON u.id = bu.user_id
      ${includeBatch ? `JOIN ${schema}.batches b ON b.id = bu.batch_id` : ''}
      WHERE ${whereSql}
      ORDER BY bu.created_at DESC
    `,
    ...params,
  );
  return rows.map(mapBatchUserRow);
}

async function attachStudentBatchUsers(batches: any[], businessId: number): Promise<any[]> {
  const batchIds = batches.map((batch) => batch.id).filter((id) => Number.isInteger(id));
  if (!batchIds.length) return batches;

  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      SELECT
        bu.*,
        u.id AS user_id, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
        u.role AS user_role, u.profile_picture AS user_profile_picture
      FROM ${schema}.batch_users bu
      JOIN public.users u ON u.id = bu.user_id
      WHERE bu.batch_id = ANY($1::int[])
        AND u.role = $2::"public"."UserRole"
      ORDER BY bu.created_at DESC
    `,
    batchIds,
    UserRole.STUDENT,
  );

  const byBatchId = new Map<number, any[]>();
  for (const row of rows) {
    const mapped = mapBatchUserRow(row);
    const list = byBatchId.get(mapped.batchId) ?? [];
    list.push(mapped);
    byBatchId.set(mapped.batchId, list);
  }

  return batches.map((batch) => ({
    ...batch,
    batchUsers: byBatchId.get(batch.id) ?? [],
  }));
}

export interface BatchFindOptions {
  where?: Prisma.BatchWhereInput;
  orderBy?: Prisma.BatchOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.BatchSelect;
  include?: Prisma.BatchInclude;
  includeStudents?: boolean;
  /** When true, batch must have active course + exam (user-facing / validation paths). */
  requireActiveHierarchy?: boolean;
}

export async function createBatch(data: Prisma.BatchCreateInput) {
  try {
    return await prisma.batch.create({
      data,
      select: {
        ...batchSelect,
        course: { select: courseSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function findBatchById(id: number, options: BatchFindOptions = {}) {
  if (options.requireActiveHierarchy) {
    const query: Prisma.BatchFindFirstArgs = {
      where: {
        id,
        ...ACTIVE_BATCH_WHERE,
        ...(options.where ?? {}),
      },
    };

    if (options.select) {
      query.select = options.select;
    } else if (options.include) {
      query.include = options.include;
    } else {
      query.select = {
        ...batchSelect,
        course: { select: courseSelect },
      };
    }

    return prisma.batch.findFirst(query);
  }

  const query: Prisma.BatchFindUniqueArgs = { where: { id } };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = {
      ...batchSelect,
      course: { select: courseSelect },
    };
  }

  return prisma.batch.findUnique(query);
}

export async function findBatchBusinessId(batchId: number): Promise<number | null> {
  const batch = await prisma.batch.findFirst({
    where: {
      id: batchId,
      ...ACTIVE_BATCH_WHERE,
    },
    select: {
      course: {
        select: {
          exam: {
            select: { businessId: true },
          },
        },
      },
    },
  });
  return batch?.course?.exam?.businessId ?? null;
}

export async function findBatchByCodeName(codeName: string) {
  return prisma.batch.findUnique({
    where: { codeName },
    select: {
      ...batchSelect,
      course: { select: courseSelect }
    },
  });
}

export interface BatchInclude extends Prisma.BatchInclude {
  students?: boolean;
}

export async function findBatchesByCourseId(courseId: number, options: BatchFindOptions = {}) {
  // Handle "students" request whether it comes from top-level flag or nested include (legacy/compatible)
  const includeOptions = options.include as BatchInclude | undefined;
  const requestIncludeStudents = options.includeStudents || includeOptions?.students;

  // Clean up the nested property if it exists to avoid Prisma errors
  if (includeOptions?.students) {
    // Shallow copy include to avoid mutating original object if used elsewhere (good practice)
    options.include = { ...includeOptions };
    const cleanInclude = options.include as BatchInclude;
    delete cleanInclude.students;
  }

  const query: Prisma.BatchFindManyArgs = {
    where: {
      courseId,
      ...ACTIVE_BATCH_WHERE,
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (requestIncludeStudents) {
    query.select = {
      ...batchSelect,
      course: { select: courseSelect }
    };
  } else if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    (query as any).select = {
      ...batchSelect,
      course: { select: courseSelect }
    };
  }

  const batches = await prisma.batch.findMany(query);
  if (!requestIncludeStudents) return batches;
  const businessId = await findCourseBusinessId(courseId);
  return businessId ? attachStudentBatchUsers(batches, businessId) : batches;
}

export async function findBatches(options: BatchFindOptions = {}) {
  // Support legacy options.include.students flag; translate it to batchUsers include and strip it out.
  const includeWithLegacy = options.include as (Prisma.BatchInclude & { students?: boolean }) | undefined;
  const requestIncludeStudents = options.includeStudents || includeWithLegacy?.students;

  if (includeWithLegacy?.students) {
    options.include = { ...options.include };
    delete (options.include as (Prisma.BatchInclude & { students?: boolean })).students;
  }

  const query: Prisma.BatchFindManyArgs = {
    where: {
      ...(options.where ?? {}),
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
    skip: options.skip!,
    take: options.take!,
  };

  if (requestIncludeStudents) {
    query.select = {
      ...batchSelect,
      course: { select: courseSelect }
    };
  } else if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = {
      ...batchSelect,
      course: { select: courseSelect }
    };
  }

  const batches = await prisma.batch.findMany(query);
  if (!requestIncludeStudents || batches.length === 0) return batches;
  const businessId = await findBatchBusinessIdRequired((batches[0] as any).id);
  return attachStudentBatchUsers(batches, businessId);
}

export async function findActiveBatchesByCourseId(courseId: number, options: BatchFindOptions = {}) {
  return findBatchesByCourseId(courseId, {
    ...options,
    where: {
      ...(options.where || {}),
      isActive: true,
    }
  });
}


export async function updateBatch(id: number, data: Prisma.BatchUpdateInput) {
  try {
    return await prisma.batch.update({
      where: { id },
      data,
      select: {
        ...batchSelect,
        course: { select: courseSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteBatch(id: number) {
  return prisma.batch.delete({
    where: { id },
  });
}

// Batch User operations
export async function addUserToBatch(userId: number, batchId: number) {
  try {
    const created = await prisma.batchUser.create({
      data: {
        userId,
        batchId
      },
      select: {
        id: true,
        userId: true,
        batchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        batch: { select: batchSelect }
      },
    });
    return (await findBatchUser(userId, batchId)) ?? created;
  } catch (error) {
    throw error;
  }
}

export async function removeUserFromBatch(userId: number, batchId: number) {
  return prisma.batchUser.delete({
    where: {
      userId_batchId: {
        userId,
        batchId
      }
    },
  });
}

export async function findBatchUser(userId: number, batchId: number) {
  const businessId = await findBatchBusinessIdRequired(batchId);
  const rows = await findBatchUsersJoined(
    businessId,
    'bu.user_id = $1 AND bu.batch_id = $2',
    [userId, batchId],
    true,
  );
  return rows[0] ?? null;
}

export async function findBatchesByUserId(userId: number) {
  return prisma.batchUser.findMany({
    where: { userId },
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      batch: {
        select: {
          ...batchSelect,
          course: { select: courseSelect }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findUsersByBatchId(batchId: number, role?: UserRole) {
  const businessId = await findBatchBusinessIdRequired(batchId);
  const rows = await findBatchUsersJoined(
    businessId,
    role ? 'bu.batch_id = $1 AND u.role = $2::"public"."UserRole"' : 'bu.batch_id = $1',
    role ? [batchId, role] : [batchId],
  );
  return rows.map(({ batchId: _batchId, updatedAt: _updatedAt, ...row }) => row);
}

export async function updateBatchUser(userId: number, batchId: number, data: Prisma.BatchUserUpdateInput) {
  try {
    const updated = await prisma.batchUser.update({
      where: {
        userId_batchId: {
          userId,
          batchId
        }
      },
      data,
      select: {
        id: true,
        userId: true,
        batchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        batch: { select: batchSelect }
      },
    });
    return (await findBatchUser(userId, batchId)) ?? updated;
  } catch (error) {
    throw error;
  }
}


export function applyBatchAccessFilters(
  options: BatchFindOptions,
  access: { role: UserRole; userId: number; businessId?: number },
): BatchFindOptions {
  const next: BatchFindOptions = {
    ...options,
    where: { ...(options.where ?? {}) },
  };

  if (access.role !== UserRole.SUPERADMIN && access.businessId) {
    next.where = {
      ...next.where,
      ...activeBatchWhereForBusiness(access.businessId),
    };
  }

  if (access.role === UserRole.TEACHER || access.role === UserRole.STUDENT) {
    next.where = {
      ...next.where,
      batchUsers: {
        some: {
          userId: access.userId,
          isActive: true
        }
      }
    };
  }

  return next;
}

export async function isActiveUserInBatch(userId: number, batchId: number): Promise<boolean> {
  const membership = await prisma.batchUser.findFirst({
    where: { userId, batchId, isActive: true },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function findActiveBatchIdsForUser(
  businessId: number,
  userId: number,
): Promise<number[]> {
  const rows = await prisma.batchUser.findMany({
    where: {
      userId,
      isActive: true,
      batch: activeBatchWhereForBusiness(businessId),
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
      batch: activeBatchWhereForBusiness(businessId),
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
    where: activeBatchWhereForBusiness(businessId),
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
      ...activeBatchWhereForBusiness(businessId),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function validateBatchIdsBelongToBusiness(
  businessId: number,
  batchIds: number[],
): Promise<boolean> {
  if (batchIds.length === 0) return true;
  const count = await prisma.batch.count({
    where: {
      id: { in: batchIds },
      ...activeBatchWhereForBusiness(businessId),
    },
  });
  return count === batchIds.length;
}
