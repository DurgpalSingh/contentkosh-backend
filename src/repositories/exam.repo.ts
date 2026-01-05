import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient(); // Removed local instantiation

const examSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
  businessId: true,
  createdAt: true,
  updatedAt: true,
};

export async function createExam(data: Prisma.ExamUncheckedCreateInput) {
  try {
    return await prisma.exam.create({
      data,
      select: examSelect,
    });
  } catch (error) {
    throw error;
  }
}

// Define options interface to replace 'any'
export interface ExamFindOptions {
  where?: Prisma.ExamWhereInput;
  orderBy?: Prisma.ExamOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.ExamSelect;
  include?: Prisma.ExamInclude;
}

export async function findExamById(id: number, options: ExamFindOptions = {}) {
  const query: any = { where: { id } };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = examSelect;
  }

  return prisma.exam.findUnique(query);
}

export async function findExamsByBusinessId(businessId: number, options: ExamFindOptions = {}) {
  const query: Prisma.ExamFindManyArgs = {
    where: {
      businessId,
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { name: 'asc' },

  };

  if (options.skip !== undefined) {
    query.skip = options.skip;
  }
  if (options.take !== undefined) {
    query.take = options.take;
  }

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    (query as any).select = examSelect;
  }

  return prisma.exam.findMany(query);
}

export async function findActiveExamsByBusinessId(businessId: number, options: ExamFindOptions = {}) {
  const query: Prisma.ExamFindManyArgs = {
    where: {
      businessId,
      status: 'ACTIVE',
      ...(options.where || {}),
    },
    orderBy: options.orderBy || { name: 'asc' },

  };

  if (options.skip !== undefined) {
    query.skip = options.skip;
  }
  if (options.take !== undefined) {
    query.take = options.take;
  }

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    (query as any).select = examSelect;
  }

  return prisma.exam.findMany(query);
}

export async function updateExam(id: number, data: Prisma.ExamUncheckedUpdateInput) {
  try {
    return await prisma.exam.update({
      where: { id },
      data,
      select: examSelect
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteExam(id: number) {
  // Soft delete
  return prisma.exam.update({
    where: { id },
    data: { status: 'INACTIVE' } as any,
  });
}
