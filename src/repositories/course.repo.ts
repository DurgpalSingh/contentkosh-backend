import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface CourseFindOptions {
  select?: Prisma.CourseSelect;
  include?: Prisma.CourseInclude;
  where?: Prisma.CourseWhereInput;
  orderBy?: Prisma.CourseOrderByWithRelationInput;
  skip?: number;
  take?: number;
}

export async function createCourse(data: Prisma.CourseUncheckedCreateInput) {
  return await prisma.course.create({
    data,
  });
}

export async function findCourseById(id: number, options: CourseFindOptions = {}) {
  const { where, orderBy, skip, take, ...findOptions } = options;
  return prisma.course.findUnique({
    where: { id },
    ...findOptions,
  });
}

export async function findCoursesByExamId(examId: number, options: CourseFindOptions = {}) {
  const { where, ...otherOptions } = options;
  return prisma.course.findMany({
    where: {
      examId,
      ...where,
    },
    orderBy: options.orderBy || { name: 'asc' },
    ...otherOptions,
  });
}

export async function updateCourse(id: number, data: Prisma.CourseUpdateInput) {
  return await prisma.course.update({
    where: { id },
    data,
  });
}

export async function deleteCourse(id: number) {
  return prisma.course.delete({
    where: { id },
  });
}
