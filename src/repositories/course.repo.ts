import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

// const prisma = new PrismaClient();

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

export async function findCourseById(id: number, options: any = {}) {
  const query: any = { where: { id } };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    // Default selection
    query.select = {
      id: true,
      name: true,
      description: true,
      duration: true,
      isActive: true,
      examId: true,
      createdAt: true,
      updatedAt: true,
    };
  }
  return prisma.course.findUnique(query);
}



export async function findCoursesByExamId(examId: number, options: any = {}) {
  const query: any = {
    where: { examId },
    orderBy: options.orderBy || { name: 'asc' },
    skip: options.skip,
    take: options.take,
  };

  if (options.select) {
    query.select = options.select;
  } else if (options.include) {
    query.include = options.include;
  } else {
    query.select = {
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
    };
  }

  return prisma.course.findMany(query);
}

export async function findActiveCoursesByExamId(examId: number, options: any = {}) {
  const query: any = {
    where: {
      examId,
      isActive: true
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
    query.select = {
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
    };
  }

  return prisma.course.findMany(query);
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
