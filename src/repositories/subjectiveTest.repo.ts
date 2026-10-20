import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { SubjectiveDisplayStatus, SubjectiveSubmissionStatus, TestStatus } from '../constants/test-enums';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
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
  displayStatus: SubjectiveDisplayStatus;
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
    orderBy: { createdAt: Prisma.SortOrder.desc },
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
    orderBy: { startAt: Prisma.SortOrder.desc },
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

/** A submission with its test: staff (`studentId` null) in the active hierarchy, a student only their own on a published test. */
export function findSubmissionWithTest(businessId: number, submissionId: string, studentId: number | null) {
  return prisma.subjectiveTestSubmission.findFirst({
    where:
      studentId === null
        ? { id: submissionId, test: { businessId, batch: ACTIVE_BATCH_WHERE } }
        : { id: submissionId, studentId, test: { businessId, status: TestStatus.PUBLISHED } },
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

// ---------------------------------------------------------------------------
// Batch roster (students are in public.users, submissions in the tenant schema).
// Display statuses and counts are calculated in SQL, so only the needed rows leave the database.
// ---------------------------------------------------------------------------

const { timeToleranceMs } = SUBJECTIVE_TEST_CONFIG;

/**
 * Same rule as getSubmissionDisplayStatus (subjectiveTest.utils): EXPIRED is an IN_PROGRESS attempt past
 * min(startedAt + duration, deadline). Needs aliases `t` (test) and `s` (submission) and the `now` CTE.
 * Only code constants are interpolated; request values are always bound parameters.
 */
const DISPLAY_STATUS_SQL = `
  CASE
    WHEN s.id IS NULL THEN '${SubjectiveDisplayStatus.NOT_STARTED}'
    WHEN s.status = ${SubjectiveSubmissionStatus.CHECKED} THEN '${SubjectiveDisplayStatus.CHECKED}'
    WHEN s.status = ${SubjectiveSubmissionStatus.SUBMITTED} THEN '${SubjectiveDisplayStatus.SUBMITTED}'
    WHEN (SELECT at_utc FROM now_utc) > LEAST(s.started_at + make_interval(mins => t.duration_minutes), t.deadline_at)
      + make_interval(secs => ${timeToleranceMs / 1000})
      THEN '${SubjectiveDisplayStatus.EXPIRED}'
    ELSE '${SubjectiveDisplayStatus.IN_PROGRESS}'
  END`;

/**
 * CTEs ending in `roster_rows`: active students of the test's batch plus anyone who already started it
 * (even if they left the batch), each with their submission (NULLs if not started) and display status.
 * Parameters: $1 subjectiveTestId, $2 now (ISO string), $3 student role, $4 active user status.
 */
const rosterRowsCtes = (schema: string) => `
  now_utc AS (SELECT ($2::timestamptz AT TIME ZONE 'UTC') AS at_utc),
  subjective_test AS (
    SELECT id, batch_id, duration_minutes, deadline_at FROM ${schema}.subjective_tests WHERE id = $1
  ),
  roster AS (
    SELECT bu.user_id AS student_id
    FROM ${schema}.batch_users bu
    JOIN subjective_test t ON t.batch_id = bu.batch_id
    JOIN public.users u ON u.id = bu.user_id
    WHERE bu.is_active = true
      AND u.role = $3::"public"."UserRole"
      AND u.status = $4::"public"."UserStatus"
    UNION
    SELECT s.student_id FROM ${schema}.subjective_test_submissions s WHERE s.subjective_test_id = $1
  ),
  roster_rows AS (
    SELECT
      u.id AS student_id, u.name AS student_name, u.email AS student_email,
      s.id AS submission_id, s.started_at, s.submitted_at, s.marks_awarded, s.remarks, s.checked_at,
      s.answer_sheet_path, (s.checked_answer_sheet_path IS NOT NULL) AS has_checked_answer_sheet,
      ${DISPLAY_STATUS_SQL} AS display_status
    FROM roster r
    CROSS JOIN subjective_test t
    JOIN public.users u ON u.id = r.student_id
    LEFT JOIN ${schema}.subjective_test_submissions s
      ON s.student_id = r.student_id AND s.subjective_test_id = t.id
  )`;

const rosterParams = (subjectiveTestId: string, now: Date) => [
  subjectiveTestId,
  now.toISOString(),
  UserRole.STUDENT,
  UserStatus.ACTIVE,
];

type SubmissionCounts = Record<SubjectiveDisplayStatus, number>;

/** Number of roster students per display status (every status present, 0 when none). */
async function countRosterByDisplayStatus(businessId: number, subjectiveTestId: string, now: Date): Promise<SubmissionCounts> {
  const countRows = await queryTenantPublic<{ display_status: SubjectiveDisplayStatus; student_count: number }>(
    businessId,
    (schema) => `
      WITH ${rosterRowsCtes(schema)}
      SELECT display_status, COUNT(*)::int AS student_count FROM roster_rows GROUP BY display_status
    `,
    ...rosterParams(subjectiveTestId, now),
  );
  const submissionCounts = Object.fromEntries(
    Object.values(SubjectiveDisplayStatus).map((displayStatus) => [displayStatus, 0]),
  ) as SubmissionCounts;
  for (const countRow of countRows) submissionCounts[countRow.display_status] = countRow.student_count;
  return submissionCounts;
}

/** The staff test detail: the test and its per-status counts, fetched in parallel (null if the test is not found). */
export async function findTestWithSubmissionCounts(businessId: number, subjectiveTestId: string, now: Date) {
  const [subjectiveTest, submissionCounts] = await Promise.all([
    findTestInBusiness(businessId, subjectiveTestId),
    countRosterByDisplayStatus(businessId, subjectiveTestId, now),
  ]);
  return subjectiveTest ? { subjectiveTest, submissionCounts } : null;
}

/** One page of the roster, filtered, sorted and paged in SQL, plus the total of matching students. */
export async function findRosterPage(
  businessId: number,
  subjectiveTestId: string,
  filters: { displayStatus?: SubjectiveDisplayStatus; searchText?: string; page: number; pageSize: number },
  now: Date,
): Promise<{ rosterEntries: RosterEntryRecord[]; totalMatching: number }> {
  const pageRows = await queryTenantPublic<any>(
    businessId,
    (schema) => `
      WITH ${rosterRowsCtes(schema)},
      matching_rows AS (
        SELECT * FROM roster_rows
        WHERE ($5::text IS NULL OR display_status = $5)
          AND ($6::text IS NULL OR strpos(lower(student_name), $6) > 0 OR strpos(lower(student_email), $6) > 0)
      ),
      page_rows AS (
        SELECT * FROM matching_rows ORDER BY student_name ASC, student_id ASC LIMIT $7::int OFFSET $8::int
      )
      -- Always one row with the total, even when the requested page is empty.
      SELECT matching_total.total_matching, page_rows.*
      FROM (SELECT COUNT(*)::int AS total_matching FROM matching_rows) matching_total
      LEFT JOIN page_rows ON true
      ORDER BY page_rows.student_name ASC, page_rows.student_id ASC
    `,
    ...rosterParams(subjectiveTestId, now),
    filters.displayStatus ?? null,
    filters.searchText ?? null,
    filters.pageSize,
    (filters.page - 1) * filters.pageSize,
  );

  return {
    totalMatching: pageRows[0]?.total_matching ?? 0,
    rosterEntries: pageRows
      .filter((row) => row.student_id !== null)
      .map((row) => ({
        studentId: row.student_id,
        studentName: row.student_name,
        studentEmail: row.student_email,
        submissionId: row.submission_id ?? null,
        displayStatus: row.display_status,
        startedAt: row.started_at ?? null,
        submittedAt: row.submitted_at ?? null,
        marksAwarded: row.marks_awarded ?? null,
        remarks: row.remarks ?? null,
        answerSheetPath: row.answer_sheet_path ?? null,
        hasCheckedAnswerSheet: row.has_checked_answer_sheet === true,
        checkedAt: row.checked_at ?? null,
      })),
  };
}
