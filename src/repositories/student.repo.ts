import { Prisma, Student } from '@prisma/client';
import { prisma } from '../config/database';
import { USER_BASIC_SELECT } from '../dtos/user.dto';

const studentDefaultInclude: Prisma.StudentInclude = {
  user: {
    select: USER_BASIC_SELECT
  },
  business: {
    select: {
      id: true,
      instituteName: true
    }
  },
  createdByUser: {
    select: USER_BASIC_SELECT
  },
  updatedByUser: {
    select: USER_BASIC_SELECT
  }
};

export interface StudentFindOptions {
  where?: Prisma.StudentWhereInput;
  orderBy?: Prisma.StudentOrderByWithRelationInput;
  skip?: number;
  take?: number;
  include?: Prisma.StudentInclude;
  select?: Prisma.StudentSelect;
}

export const createStudent = async (
  data: Prisma.StudentCreateInput,
  options: { include?: Prisma.StudentInclude; select?: Prisma.StudentSelect } = {}
): Promise<Student> => {
  return await prisma.student.create({
    data,
    ...(options.select ? { select: options.select } : {}),
    ...(options.include ? { include: options.include } : {})
  });
};

export const findStudentById = async (
  id: number,
  options: Pick<StudentFindOptions, 'include' | 'select'> = {}
): Promise<Student | null> => {
  if (options.select) {
    return await prisma.student.findUnique({
      where: { id },
      select: options.select
    });
  }

  return await prisma.student.findUnique({
    where: { id },
    include: options.include || studentDefaultInclude
  });
};

export const findStudentByUserId = async (
  userId: number,
  options: Pick<StudentFindOptions, 'include' | 'select'> = {}
): Promise<Student | null> => {
  if (options.select) {
    return await prisma.student.findUnique({
      where: { userId },
      select: options.select
    });
  }

  return await prisma.student.findUnique({
    where: { userId },
    include: options.include || studentDefaultInclude
  });
};

export const findStudentsByBusinessId = async (
  businessId: number,
  options: StudentFindOptions = {}
): Promise<Student[]> => {
  const where: Prisma.StudentWhereInput = {
    businessId,
    ...options.where
  };

  if (options.select) {
    return await prisma.student.findMany({
      where,
      orderBy: options.orderBy || { createdAt: 'desc' },
      ...(options.skip !== undefined && { skip: options.skip }),
      ...(options.take !== undefined && { take: options.take }),
      select: options.select
    });
  }

  return await prisma.student.findMany({
    where,
    orderBy: options.orderBy || { createdAt: 'desc' },
    ...(options.skip !== undefined && { skip: options.skip }),
    ...(options.take !== undefined && { take: options.take }),
    include: options.include || studentDefaultInclude
  });
};

export const updateStudent = async (
  id: number,
  data: Prisma.StudentUpdateInput,
  options: { include?: Prisma.StudentInclude; select?: Prisma.StudentSelect } = {}
): Promise<Student> => {
  return await prisma.student.update({
    where: { id },
    data,
    ...(options.select ? { select: options.select } : {}),
    ...(options.include ? { include: options.include } : {})
  });
};

export const checkStudentExists = async (studentId: number): Promise<boolean> => {
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  });
  return !!student;
};
