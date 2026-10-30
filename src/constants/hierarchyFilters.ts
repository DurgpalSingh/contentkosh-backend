import { CourseStatus, ExamStatus, Prisma, SubjectStatus } from '@prisma/client';

/** Exam row is active (not soft-deleted). */
export const ACTIVE_EXAM_WHERE = { status: ExamStatus.ACTIVE } as const;

/** Course with active parent exam. */
export const ACTIVE_COURSE_WHERE = {
  status: CourseStatus.ACTIVE,
  exam: ACTIVE_EXAM_WHERE,
} as const;

/** Batch with active course and exam chain. */
export const ACTIVE_BATCH_WHERE = {
  isActive: true,
  course: ACTIVE_COURSE_WHERE,
} as const;

/** Subject with active course and exam chain. */
export const ACTIVE_SUBJECT_WHERE = {
  status: SubjectStatus.ACTIVE,
  course: ACTIVE_COURSE_WHERE,
} as const;

/** Batch in a business with full active ancestor chain. */
export function activeBatchWhereForBusiness(businessId: number): Prisma.BatchWhereInput {
  return {
    isActive: true,
    course: {
      status: CourseStatus.ACTIVE,
      exam: { businessId, status: ExamStatus.ACTIVE },
    },
  };
}

/** Course in a business with active exam. */
export function activeCourseWhereForBusiness(businessId: number): Prisma.CourseWhereInput {
  return {
    status: CourseStatus.ACTIVE,
    exam: { businessId, status: ExamStatus.ACTIVE },
  };
}
