import { Prisma, Teacher } from '@prisma/client';
import { prisma } from '../config/database';

const userBasicSelect: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true,
  mobile: true
};

const teacherDefaultInclude: Prisma.TeacherInclude = {
  user: {
    select: userBasicSelect
  },
  business: {
    select: {
      id: true,
      instituteName: true
    }
  },
  createdByUser: {
    select: userBasicSelect
  },
  updatedByUser: {
    select: userBasicSelect
  }
};

export interface TeacherFindOptions {
  where?: Prisma.TeacherWhereInput;
  orderBy?: Prisma.TeacherOrderByWithRelationInput;
  skip?: number;
  take?: number;
  include?: Prisma.TeacherInclude;
  select?: Prisma.TeacherSelect;
}

export const createTeacher = async (
  data: Prisma.TeacherCreateInput
): Promise<Teacher> => {
  return await prisma.teacher.create({
    data,
    include: teacherDefaultInclude
  });
};

export const findTeacherById = async (
  id: number,
  options: Pick<TeacherFindOptions, 'include' | 'select'> = {}
): Promise<Teacher | null> => {
  if (options.select) {
    return await prisma.teacher.findUnique({
      where: { id },
      select: options.select
    });
  }

  return await prisma.teacher.findUnique({
    where: { id },
    include: options.include || teacherDefaultInclude
  });
};

export const findTeacherByUserId = async (
  userId: number,
  options: Pick<TeacherFindOptions, 'include' | 'select'> = {}
): Promise<Teacher | null> => {
  if (options.select) {
    return await prisma.teacher.findUnique({
      where: { userId },
      select: options.select
    });
  }

  return await prisma.teacher.findUnique({
    where: { userId },
    include: options.include || teacherDefaultInclude
  });
};

export const findTeachersByBusinessId = async (
  businessId: number,
  options: TeacherFindOptions = {}
): Promise<Teacher[]> => {
  const where: Prisma.TeacherWhereInput = {
    businessId,
    ...options.where
  };

  if (options.select) {
    return await prisma.teacher.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      select: options.select
    });
  }

  return await prisma.teacher.findMany({
    where,
    orderBy: options.orderBy || { createdAt: 'desc' },
    ...(options.skip !== undefined && { skip: options.skip }),
    ...(options.take !== undefined && { take: options.take }),
    include: options.include || teacherDefaultInclude
  });
};

export const updateTeacher = async (
  id: number,
  data: Prisma.TeacherUpdateInput
): Promise<Teacher> => {
  return await prisma.teacher.update({
    where: { id },
    data,
    include: teacherDefaultInclude
  });
};

export const deleteTeacher = async (id: number): Promise<void> => {
  await prisma.teacher.delete({
    where: { id }
  });
};

export const checkTeacherExists = async (teacherId: number): Promise<boolean> => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId }
  });
  return !!teacher;
};
