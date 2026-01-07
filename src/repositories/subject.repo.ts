import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface SubjectFindOptions {
  select?: Prisma.SubjectSelect;
  include?: Prisma.SubjectInclude;
  where?: Prisma.SubjectWhereInput;
  orderBy?: Prisma.SubjectOrderByWithRelationInput;
  skip?: number;
  take?: number;
}

export async function createSubject(data: Prisma.SubjectUncheckedCreateInput) {
  return await prisma.subject.create({
    data,
  });
}

export async function findSubjectById(id: number, options: SubjectFindOptions = {}) {
  const { where, orderBy, skip, take, ...findOptions } = options;
  return prisma.subject.findUnique({
    where: { id },
    ...findOptions,
  });
}

export async function findSubjectsByCourseId(courseId: number, options: SubjectFindOptions = {}) {
  const { where, ...otherOptions } = options;
  return prisma.subject.findMany({
    where: {
      courseId,
      ...where,
    },
    orderBy: options.orderBy || { name: 'asc' },
    ...otherOptions,
  });
}

export async function updateSubject(id: number, data: Prisma.SubjectUpdateInput) {
  return await prisma.subject.update({
    where: { id },
    data,
  });
}

export async function deleteSubject(id: number) {
  return await prisma.subject.delete({
    where: { id },
  });
}
