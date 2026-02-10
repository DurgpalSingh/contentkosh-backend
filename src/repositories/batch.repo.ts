import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';

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
};

export interface BatchFindOptions {
  where?: Prisma.BatchWhereInput;
  orderBy?: Prisma.BatchOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.BatchSelect;
  include?: Prisma.BatchInclude;
  includeStudents?: boolean;
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
  const query: any = { where: { id } };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = {
      ...batchSelect,
      course: { select: courseSelect }
    };
  }

  return prisma.batch.findUnique(query);
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
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (requestIncludeStudents) {
    // Custom include logic for students - overrides standard select/include
    query.include = {
      ...(options.include || {}),
      batchUsers: {
        where: {
          user: { role: UserRole.STUDENT }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true,
              role: true
            }
          }
        }
      }
    };
    // Ensure we don't send includeStudents to prisma if we were spreading options elsewhere (though we aren't here)
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

  return prisma.batch.findMany(query);
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
    return await prisma.batchUser.create({
      data: {
        user: { connect: { id: userId } },
        batch: { connect: { id: batchId } }
      },
      select: {
        id: true,
        userId: true,
        batchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        user: { select: userSelect },
        batch: { select: batchSelect }
      },
    });
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
  return prisma.batchUser.findUnique({
    where: {
      userId_batchId: {
        userId,
        batchId
      }
    },
    select: {
      id: true,
      userId: true,
      batchId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: { select: userSelect },
      batch: { select: batchSelect }
    },
  });
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
  const where: any = { batchId };

  if (role) {
    where.user = { role };
  }

  return prisma.batchUser.findMany({
    where,
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      user: { select: userSelect }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateBatchUser(userId: number, batchId: number, data: Prisma.BatchUserUpdateInput) {
  try {
    return await prisma.batchUser.update({
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
        user: { select: userSelect },
        batch: { select: batchSelect }
      },
    });
  } catch (error) {
    throw error;
  }
}


