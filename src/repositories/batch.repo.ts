import { Prisma } from '@prisma/client';
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

export async function findBatchesByCourseId(courseId: number, options: BatchFindOptions = {}) {
  const query: Prisma.BatchFindManyArgs = {
    where: {
      courseId,
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) {
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
  const query: Prisma.BatchFindManyArgs = {
    where: {
      courseId,
      isActive: true,
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) {
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

export async function findUsersByBatchId(batchId: number) {
  return prisma.batchUser.findMany({
    where: { batchId },
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
