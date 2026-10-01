import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { SubjectiveSubmissionStatus, TestStatus } from '../constants/test-enums';
import { ACTIVE_BATCH_WHERE } from '../constants/hierarchyFilters';
import { queryTenantPublic } from './crossSchema.repo';

const subjectiveTestSelect = {
  id: true,
  businessId: true,
  batchId: true,
  batch: {
    select: {
      id: true,
      displayName: true,
    },
  },
  subjectId: true,
  subject: {
    select: {
      id: true,
      name: true,
    },
  },
  name: true,
  paperType: true,
  description: true,
  instructions: true,
  status: true,
  totalMarks: true,
  durationMinutes: true,
  startAt: true,
  deadlineAt: true,
  questionPaperPath: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubjectiveTestSelect;

const submissionSelect = {
  id: true,
  subjectiveTestId: true,
  studentId: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  answerSheetPath: true,
  marksAwarded: true,
  remarks: true,
  checkedAnswerSheetPath: true,
  checkedBy: true,
  checkedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubjectiveTestSubmissionSelect;

export type SubjectiveTestRecord = Prisma.SubjectiveTestGetPayload<{ select: typeof subjectiveTestSelect }>;
export type SubjectiveSubmissionRecord = Prisma.SubjectiveTestSubmissionGetPayload<{ select: typeof submissionSelect }>;

/** Batch roster merged with submissions; a null `submissionId` means the student never started. */
export type SubjectiveRosterRow = {
  studentId: number;
  studentName: string;
  studentEmail: string;
  submissionId: string | null;
  status: number | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  marksAwarded: number | null;
  checkedAt: Date | null;
};

const studentMembershipWhere = (userId: number): Prisma.BatchWhereInput => ({
  ...ACTIVE_BATCH_WHERE,
  batchUsers: { some: { userId, isActive: true } },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function createSubjectiveTest(data: Prisma.SubjectiveTestUncheckedCreateInput) {
  return prisma.subjectiveTest.create({
    data,
    select: subjectiveTestSelect,
  });
}

export function findSubjectiveTestById(businessId: number, id: string) {
  return prisma.subjectiveTest.findFirst({
    where: { id, businessId, batch: ACTIVE_BATCH_WHERE },
    select: subjectiveTestSelect,
  });
}

export function findSubjectiveTestsByBusinessId(businessId: number, where: Prisma.SubjectiveTestWhereInput = {}) {
  return prisma.subjectiveTest.findMany({
    where: { businessId, batch: ACTIVE_BATCH_WHERE, ...where },
    select: subjectiveTestSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export function updateSubjectiveTest(
  businessId: number,
  id: string,
  data: Prisma.SubjectiveTestUncheckedUpdateInput,
) {
  return prisma.subjectiveTest.update({
    where: { id, businessId },
    data,
    select: subjectiveTestSelect,
  });
}

export function deleteSubjectiveTest(businessId: number, id: string) {
  return prisma.subjectiveTest.deleteMany({
    where: { id, businessId },
  });
}

export function findPublishedSubjectiveTestForStudent(businessId: number, id: string, userId: number) {
  return prisma.subjectiveTest.findFirst({
    where: { id, businessId, status: TestStatus.PUBLISHED, batch: studentMembershipWhere(userId) },
    select: subjectiveTestSelect,
  });
}

export function findPublishedSubjectiveTestsForStudent(businessId: number, userId: number) {
  return prisma.subjectiveTest.findMany({
    where: { businessId, status: TestStatus.PUBLISHED, batch: studentMembershipWhere(userId) },
    select: subjectiveTestSelect,
    orderBy: { startAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function countSubmissionsForTest(subjectiveTestId: string) {
  return prisma.subjectiveTestSubmission.count({
    where: { subjectiveTestId },
  });
}

export function createSubmission(data: Prisma.SubjectiveTestSubmissionUncheckedCreateInput) {
  return prisma.subjectiveTestSubmission.create({
    data,
    select: submissionSelect,
  });
}

export function findSubmissionByTestAndStudent(subjectiveTestId: string, studentId: number) {
  return prisma.subjectiveTestSubmission.findUnique({
    where: { subjectiveTestId_studentId: { subjectiveTestId, studentId } },
    select: submissionSelect,
  });
}

export function findSubmissionsForStudent(studentId: number, subjectiveTestIds: string[]) {
  if (!subjectiveTestIds.length) return Promise.resolve([]);
  return prisma.subjectiveTestSubmission.findMany({
    where: { studentId, subjectiveTestId: { in: subjectiveTestIds } },
    select: submissionSelect,
  });
}

export function findSubmissionForTest(subjectiveTestId: string, submissionId: string) {
  return prisma.subjectiveTestSubmission.findFirst({
    where: { id: submissionId, subjectiveTestId },
    select: submissionSelect,
  });
}

/** Own submission for a student, scoped to a published test in the business. */
export function findStudentSubmissionWithTest(businessId: number, submissionId: string, studentId: number) {
  return prisma.subjectiveTestSubmission.findFirst({
    where: {
      id: submissionId,
      studentId,
      test: { businessId, status: TestStatus.PUBLISHED },
    },
    select: { ...submissionSelect, test: { select: subjectiveTestSelect } },
  });
}

/** Atomically moves IN_PROGRESS → SUBMITTED. Returns the number of rows changed (0 = already submitted). */
export async function markSubmissionSubmitted(
  submissionId: string,
  data: { answerSheetPath: string; submittedAt: Date },
): Promise<number> {
  const result = await prisma.subjectiveTestSubmission.updateMany({
    where: { id: submissionId, status: SubjectiveSubmissionStatus.IN_PROGRESS },
    data: { ...data, status: SubjectiveSubmissionStatus.SUBMITTED },
  });
  return result.count;
}

/**
 * Saves grading. `expectedCheckedPath` is the checked-file key the caller read; the
 * update only applies if it is still current, so two concurrent regrades cannot orphan a file.
 * Returns the number of rows changed (0 = changed by someone else).
 */
export async function updateSubmissionGrade(
  submissionId: string,
  expectedCheckedPath: string | null,
  data: { marksAwarded: number; remarks: string | null; checkedAnswerSheetPath: string; checkedBy: number; checkedAt: Date },
): Promise<number> {
  const result = await prisma.subjectiveTestSubmission.updateMany({
    where: {
      id: submissionId,
      status: { in: [SubjectiveSubmissionStatus.SUBMITTED, SubjectiveSubmissionStatus.CHECKED] },
      checkedAnswerSheetPath: expectedCheckedPath,
    },
    data: { ...data, status: SubjectiveSubmissionStatus.CHECKED },
  });
  return result.count;
}

/**
 * Active students of the batch plus anyone who already has a submission for the test
 * (so students who left the batch after submitting are still listed).
 */
export async function findSubmissionRoster(
  businessId: number,
  subjectiveTestId: string,
  batchId: number,
): Promise<SubjectiveRosterRow[]> {
  const rows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      WITH roster AS (
        SELECT bu.user_id
        FROM ${schema}.batch_users bu
        JOIN public.users u ON u.id = bu.user_id
        WHERE bu.batch_id = $1
          AND bu.is_active = true
          AND u.role = $3::"public"."UserRole"
          AND u.status = $4::"public"."UserStatus"
        UNION
        SELECT s.student_id
        FROM ${schema}.subjective_test_submissions s
        WHERE s.subjective_test_id = $2
      )
      SELECT
        u.id AS student_id, u.name AS student_name, u.email AS student_email,
        s.id AS submission_id, s.status, s.started_at, s.submitted_at, s.marks_awarded, s.checked_at
      FROM roster r
      JOIN public.users u ON u.id = r.user_id
      LEFT JOIN ${schema}.subjective_test_submissions s
        ON s.student_id = r.user_id AND s.subjective_test_id = $2
      ORDER BY u.name ASC
    `,
    batchId,
    subjectiveTestId,
    UserRole.STUDENT,
    UserStatus.ACTIVE,
  );

  return rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    submissionId: row.submission_id ?? null,
    status: row.status ?? null,
    startedAt: row.started_at ?? null,
    submittedAt: row.submitted_at ?? null,
    marksAwarded: row.marks_awarded ?? null,
    checkedAt: row.checked_at ?? null,
  }));
}
