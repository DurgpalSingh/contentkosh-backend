import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

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

export async function findExamById(id: number, options: any = {}) {
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

export async function findExamsByBusinessId(businessId: number, options: any = {}) {
  const query: any = {
    where: { businessId },
    orderBy: options.orderBy || { name: 'asc' },
    skip: options.skip,
    take: options.take,
  };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = examSelect;
  }

  return prisma.exam.findMany(query);
}

export async function findActiveExamsByBusinessId(businessId: number, options: any = {}) {
  const query: any = {
    where: {
      businessId,
      status: 'ACTIVE'
    },
    orderBy: options.orderBy || { name: 'asc' },
    skip: options.skip,
    take: options.take,
  };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = examSelect;
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
