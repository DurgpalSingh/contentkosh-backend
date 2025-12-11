import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const examSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
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

export async function findExamById(id: number) {
  return prisma.exam.findUnique({
    where: { id },
    select: examSelect,
  });
}

const courseSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  examId: true,
};

export async function findExamWithCourses(id: number) {
  return prisma.exam.findUnique({
    where: { id },
    select: {
      ...examSelect,
      courses: {
        where: { isActive: true },
        select: courseSelect,
        orderBy: { name: 'asc' },
      },
    },
  });
}

export async function findExamsByBusinessId(businessId: number) {
  return prisma.exam.findMany({
    where: { businessId },
    select: examSelect,
    orderBy: { name: 'asc' },
  });
}

export async function findActiveExamsByBusinessId(businessId: number) {
  return prisma.exam.findMany({
    where: { 
      businessId,
      isActive: true 
    },
    select: examSelect,
    orderBy: { name: 'asc' },
  });
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
    data: { isActive: false },
  });
}
