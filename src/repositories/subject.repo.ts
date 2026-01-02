import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient();

export async function createSubject(data: Prisma.SubjectCreateInput) {
  try {
    return await prisma.subject.create({
      data,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        courseId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function findSubjectById(id: number) {
  return prisma.subject.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      courseId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findSubjectsByCourseId(courseId: number) {
  return prisma.subject.findMany({
    where: { courseId },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      courseId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function findActiveSubjectsByCourseId(courseId: number) {
  return prisma.subject.findMany({
    where: {
      courseId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      courseId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

export async function updateSubject(id: number, data: Prisma.SubjectUpdateInput) {
  try {
    return await prisma.subject.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        courseId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteSubject(id: number) {
  return prisma.subject.delete({
    where: { id },
  });
}
