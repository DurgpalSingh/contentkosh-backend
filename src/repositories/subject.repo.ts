import { Prisma, SubjectStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import type { IUser } from '../dtos/auth.dto';

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

export async function findSubjectCourseId(subjectId: number): Promise<number | null> {
  const row = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { courseId: true },
  });
  return row?.courseId ?? null;
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

export async function findSubjectsByUserId(
  requestingUser: IUser,
  options: SubjectFindOptions = {}
) {
  const { where, orderBy, skip, take, ...otherOptions } = options;

  const status =
    where && 'status' in where && where.status !== undefined
      ? where.status
      : SubjectStatus.ACTIVE;

  const isSelfTeacherOrStudent =
    requestingUser.role === UserRole.TEACHER || requestingUser.role === UserRole.STUDENT;

  const subjects = await prisma.subject.findMany({
    where: {
      ...(where ?? {}),
      status,
      // Role-aware scoping:
      // - TEACHER/STUDENT: subjects from active batches where user is a member
      // - ADMIN/SUPERADMIN: subjects from active batches in their business (no batch membership required)
      course: {
        ...(requestingUser.role !== UserRole.SUPERADMIN
          ? { exam: { businessId: requestingUser.businessId! } }
          : {}),
        batches: {
          some: {
            isActive: true,
            ...(isSelfTeacherOrStudent
              ? {
                batchUsers: {
                  some: {
                    userId: requestingUser.id,
                    isActive: true
                  }
                }
              }
              : {})
          }
        }
      }
    },
    orderBy: orderBy || { name: 'asc' },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
    ...otherOptions
  });

  return subjects;
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
