import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export async function updateProfileTransaction(params: {
  userId: number;
  userUpdate?: Prisma.UserUpdateInput | Record<string, unknown> | null | undefined;
  teacherId?: number | null | undefined;
  teacherUpdate?: Prisma.TeacherUpdateInput | Record<string, unknown> | null | undefined;
  studentId?: number | null | undefined;
  studentUpdate?: Prisma.StudentUpdateInput | Record<string, unknown> | null | undefined;
  businessId?: number | null | undefined;
  businessUpdate?: Prisma.BusinessUpdateInput | Record<string, unknown> | null | undefined;
}) {
  const ops: Array<Prisma.PrismaPromise<unknown>> = [];

  if (params.userUpdate && Object.keys(params.userUpdate as any).length > 0) {
    ops.push(
      prisma.user.update({
        where: { id: params.userId },
        data: params.userUpdate as Prisma.UserUpdateInput,
      })
    );
  }

  if (params.teacherId && params.teacherUpdate && Object.keys(params.teacherUpdate as any).length > 0) {
    ops.push(
      prisma.teacher.update({
        where: { id: params.teacherId },
        data: params.teacherUpdate as Prisma.TeacherUpdateInput,
      })
    );
  }

  if (params.studentId && params.studentUpdate && Object.keys(params.studentUpdate as any).length > 0) {
    ops.push(
      prisma.student.update({
        where: { id: params.studentId },
        data: params.studentUpdate as Prisma.StudentUpdateInput,
      })
    );
  }

  if (params.businessId && params.businessUpdate && Object.keys(params.businessUpdate as any).length > 0) {
    ops.push(
      prisma.business.update({
        where: { id: params.businessId },
        data: params.businessUpdate as Prisma.BusinessUpdateInput,
      })
    );
  }

  if (ops.length === 0) return null;

  // Run all updates in a single transaction
  return await prisma.$transaction(ops);
}

export default updateProfileTransaction;
