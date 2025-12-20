import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function createCourse(data: Prisma.CourseCreateInput) {
  try {
    return await prisma.course.create({
      data,
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        isActive: true,
        examId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function findCourseById(id: number) {
  return prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      isActive: true,
      examId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findCourseWithSubjects(id: number) {
  return prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      isActive: true,
      examId: true,
      createdAt: true,
      updatedAt: true,
      subjects: {
        where: { isActive: true },
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
      },
    },
  });
}

export async function findCoursesByExamId(examId: number) {
  return prisma.course.findMany({
    where: { examId },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      isActive: true,
      examId: true,
      createdAt: true,
      updatedAt: true,
      exam: {
        select: {
          name: true
        }
      },
      subjects: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { name: 'asc' },
  });
}

export async function findActiveCoursesByExamId(examId: number) {
  return prisma.course.findMany({
    where: { 
      examId,
      isActive: true 
    },
    select: {
      id: true,
      name: true,
      description: true,
      duration: true,
      isActive: true,
      examId: true,
      createdAt: true,
      updatedAt: true,
      exam: {
        select: {
          name: true
        }
      },
      subjects: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { name: 'asc' },
  });
}

export async function updateCourse(id: number, data: Prisma.CourseUpdateInput) {
  try {
    return await prisma.course.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        isActive: true,
        examId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteCourse(id: number) {
  return prisma.course.delete({
    where: { id },
  });
}
