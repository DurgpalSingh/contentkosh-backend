import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { BadRequestError } from '../errors/api.errors';
import { ExamStatus } from '@prisma/client';

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
    return prisma.$transaction(
      async (tx) => {
        // Guard: active exam with same name in same business
        const existing = await tx.exam.findFirst({
          where: {
            businessId: data.businessId,
            name: data.name,
            status: ExamStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (existing) {
          throw new BadRequestError('Exam with this name already exists for this business');
        }

        return tx.exam.create({
          data,
          select: examSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
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
    return prisma.$transaction(
      async (tx) => {
        // If name is being changed, enforce uniqueness
        if (data.name) {
          const existing = await tx.exam.findFirst({
            where: {
              businessId: data.businessId as number,
              name: data.name as string,
              status: 'ACTIVE',
              NOT: { id },
            },
            select: { id: true },
          });

          if (existing) {
            throw new BadRequestError('Exam with this name already exists for this business');
          }
        }

        return tx.exam.update({
          where: { id },
          data,
          select: examSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
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
