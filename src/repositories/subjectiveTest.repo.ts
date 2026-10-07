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

const submissionWithTestSelect = { ...submissionSelect, test: { select: subjectiveTestSelect } };

export type SubjectiveTestRecord = Prisma.SubjectiveTestGetPayload<{ select: typeof subjectiveTestSelect }>;
export type SubjectiveSubmissionRecord = Prisma.SubjectiveTestSubmissionGetPayload<{ select: typeof submissionSelect }>;
export type SubjectiveSubmissionWithTestRecord = Prisma.SubjectiveTestSubmissionGetPayload<{
  select: typeof submissionWithTestSelect;
}>;
/** A published test plus the requesting student's own attempt (empty array if not started). */
export type StudentTestWithOwnAttemptRecord = SubjectiveTestRecord & { submissions: SubjectiveSubmissionRecord[] };

/** One batch student and their submission; `submissionId` null means they never started. */
export type RosterEntryRecord = {
  studentId: number;
  studentName: string;
  studentEmail: string;
  submissionId: string | null;
  status: number | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  marksAwarded: number | null;
  remarks: string | null;
  answerSheetPath: string | null;
  hasCheckedAnswerSheet: boolean;
  checkedAt: Date | null;
};

const enrolledStudentBatchWhere = (studentId: number): Prisma.BatchWhereInput => ({
  ...ACTIVE_BATCH_WHERE,
  batchUsers: { some: { userId: studentId, isActive: true } },
});

const publishedTestForStudentWhere = (businessId: number, studentId: number): Prisma.SubjectiveTestWhereInput => ({
  businessId,
  status: TestStatus.PUBLISHED,
  batch: enrolledStudentBatchWhere(studentId),
});

const testWithOwnAttemptSelect = (studentId: number) => ({
  ...subjectiveTestSelect,
  submissions: { where: { studentId }, select: submissionSelect, take: 1 },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function insertDraftTest(data: Prisma.SubjectiveTestUncheckedCreateInput) {
  return prisma.subjectiveTest.create({ data, select: subjectiveTestSelect });
}

export function findTestInBusiness(businessId: number, subjectiveTestId: string) {
  return prisma.subjectiveTest.findFirst({
    where: { id: subjectiveTestId, businessId, batch: ACTIVE_BATCH_WHERE },
    select: subjectiveTestSelect,
  });
}

export function findTestsInBusiness(businessId: number, filters: Prisma.SubjectiveTestWhereInput) {
  return prisma.subjectiveTest.findMany({
    where: { businessId, batch: ACTIVE_BATCH_WHERE, ...filters },
    select: subjectiveTestSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export function updateTest(businessId: number, subjectiveTestId: string, data: Prisma.SubjectiveTestUncheckedUpdateInput) {
  return prisma.subjectiveTest.update({
    where: { id: subjectiveTestId, businessId },
    data,
    select: subjectiveTestSelect,
  });
}

export function deleteTest(businessId: number, subjectiveTestId: string) {
  return prisma.subjectiveTest.deleteMany({ where: { id: subjectiveTestId, businessId } });
}

export function findPublishedTestsWithOwnAttempt(businessId: number, studentId: number) {
  return prisma.subjectiveTest.findMany({
    where: publishedTestForStudentWhere(businessId, studentId),
    select: testWithOwnAttemptSelect(studentId),
    orderBy: { startAt: 'desc' },
  }) as Promise<StudentTestWithOwnAttemptRecord[]>;
}

export function findPublishedTestWithOwnAttempt(businessId: number, subjectiveTestId: string, studentId: number) {
  return prisma.subjectiveTest.findFirst({
    where: { id: subjectiveTestId, ...publishedTestForStudentWhere(businessId, studentId) },
    select: testWithOwnAttemptSelect(studentId),
  }) as Promise<StudentTestWithOwnAttemptRecord | null>;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export function insertInProgressAttempt(subjectiveTestId: string, studentId: number, startedAt: Date) {
  return prisma.subjectiveTestSubmission.create({
    data: { subjectiveTestId, studentId, startedAt, status: SubjectiveSubmissionStatus.IN_PROGRESS },
    select: submissionSelect,
  });
}

export function findAttemptByTestAndStudent(subjectiveTestId: string, studentId: number) {
  return prisma.subjectiveTestSubmission.findUnique({
    where: { subjectiveTestId_studentId: { subjectiveTestId, studentId } },
    select: submissionSelect,
  });
}

/** Staff view: a submission of a test in the business (active hierarchy), with its test. */
export function findSubmissionWithTest(businessId: number, subjectiveTestId: string, submissionId: string) {
  return prisma.subjectiveTestSubmission.findFirst({
    where: { id: submissionId, subjectiveTestId, test: { businessId, batch: ACTIVE_BATCH_WHERE } },
    select: submissionWithTestSelect,
  });
}

/** Student view: their own submission of a published test, with its test. */
export function findOwnSubmissionWithTest(businessId: number, submissionId: string, studentId: number) {
  return prisma.subjectiveTestSubmission.findFirst({
    where: { id: submissionId, studentId, test: { businessId, status: TestStatus.PUBLISHED } },
    select: submissionWithTestSelect,
  });
}

/**
 * IN_PROGRESS → SUBMITTED. The status condition makes it atomic: a second concurrent submit
 * matches no row and Prisma throws RECORD_NOT_FOUND (handled by the service).
 */
export function markAttemptSubmitted(submissionId: string, answerSheetPath: string, submittedAt: Date) {
  return prisma.subjectiveTestSubmission.update({
    where: { id: submissionId, status: SubjectiveSubmissionStatus.IN_PROGRESS },
    data: { answerSheetPath, submittedAt, status: SubjectiveSubmissionStatus.SUBMITTED },
    select: submissionSelect,
  });
}

/**
 * Saves marks/remarks/checked copy. Only applies if the checked copy is still the one the
 * caller read, so two concurrent regrades can't orphan a file; otherwise RECORD_NOT_FOUND.
 */
export function saveGrade(
  submissionId: string,
  checkedAnswerSheetPathReadByCaller: string | null,
  grade: { marksAwarded: number; remarks: string | null; checkedAnswerSheetPath: string; checkedBy: number; checkedAt: Date },
) {
  return prisma.subjectiveTestSubmission.update({
    where: {
      id: submissionId,
      status: { in: [SubjectiveSubmissionStatus.SUBMITTED, SubjectiveSubmissionStatus.CHECKED] },
      checkedAnswerSheetPath: checkedAnswerSheetPathReadByCaller,
    },
    data: { ...grade, status: SubjectiveSubmissionStatus.CHECKED },
    select: submissionSelect,
  });
}

export function findAttemptTimingsForTest(subjectiveTestId: string) {
  return prisma.subjectiveTestSubmission.findMany({
    where: { subjectiveTestId },
    select: { status: true, startedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Batch roster (students are in public.users, submissions in the tenant schema)
// ---------------------------------------------------------------------------

/** Active batch students, plus anyone who already submitted (even if they left the batch). */
export async function findRosterWithSubmissions(
  businessId: number,
  subjectiveTestId: string,
  batchId: number,
): Promise<RosterEntryRecord[]> {
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
        s.id AS submission_id, s.status, s.started_at, s.submitted_at, s.marks_awarded, s.checked_at,
        s.remarks, s.answer_sheet_path, (s.checked_answer_sheet_path IS NOT NULL) AS has_checked_answer_sheet
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
    remarks: row.remarks ?? null,
    answerSheetPath: row.answer_sheet_path ?? null,
    hasCheckedAnswerSheet: row.has_checked_answer_sheet === true,
    checkedAt: row.checked_at ?? null,
  }));
}

/** Active batch students who have not started the test. */
export async function countStudentsNotStarted(businessId: number, subjectiveTestId: string, batchId: number) {
  const [result] = await queryTenantPublic<{ count: bigint }>(
    businessId,
    (schema) => `
      SELECT COUNT(*) AS count
      FROM ${schema}.batch_users bu
      JOIN public.users u ON u.id = bu.user_id
      WHERE bu.batch_id = $1
        AND bu.is_active = true
        AND u.role = $3::"public"."UserRole"
        AND u.status = $4::"public"."UserStatus"
        AND NOT EXISTS (
          SELECT 1 FROM ${schema}.subjective_test_submissions s
          WHERE s.student_id = bu.user_id AND s.subjective_test_id = $2
        )
    `,
    batchId,
    subjectiveTestId,
    UserRole.STUDENT,
    UserStatus.ACTIVE,
  );
  return Number(result?.count ?? 0);
}
