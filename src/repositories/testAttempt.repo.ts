import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import logger from '../utils/logger';

const attemptSelect = {
  id: true,
  practiceTestId: true,
  examTestId: true,
  userId: true,
  status: true,
  startedAt: true,
  submittedAt: true,
  score: true,
  totalScore: true,
  percentage: true,
  createdAt: true,
  updatedAt: true,
};

export type TestAttemptFindOptions = Omit<Prisma.TestAttemptFindManyArgs, 'where'> & {
  where?: Prisma.TestAttemptWhereInput;
};

export type TestAttemptRecord = Prisma.TestAttemptGetPayload<{ select: typeof attemptSelect }>;

export function createTestAttempt(data: Prisma.TestAttemptUncheckedCreateInput): Promise<TestAttemptRecord> {
  return prisma.testAttempt.create({
    data,
    select: attemptSelect,
  });
}

export async function findTestAttemptWithInclude<I extends Prisma.TestAttemptInclude>(
  id: string,
  include: I,
): Promise<Prisma.TestAttemptGetPayload<{ include: I }> | null> {
  return prisma.testAttempt.findUnique({
    where: { id },
    include,
  });
}

export type TestAttemptWithAnswers = Prisma.TestAttemptGetPayload<{ include: { answers: true } }>;

export function findPracticeAttemptsByUser(
  practiceTestId: string,
  userId: number,
  options: TestAttemptFindOptions = {},
): Promise<TestAttemptRecord[]> {
  const query: Prisma.TestAttemptFindManyArgs = {
    where: { practiceTestId, userId, ...(options.where ?? {}) },
    orderBy: options.orderBy ?? { startedAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = attemptSelect;

  return prisma.testAttempt.findMany(query);
}

export function findExamAttemptsByUser(
  examTestId: string,
  userId: number,
  options: TestAttemptFindOptions = {},
): Promise<TestAttemptRecord[]> {
  const query: Prisma.TestAttemptFindManyArgs = {
    where: { examTestId, userId, ...(options.where ?? {}) },
    orderBy: options.orderBy ?? { startedAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = attemptSelect;

  return prisma.testAttempt.findMany(query);
}

export function updateTestAttempt(
  id: string,
  data: Prisma.TestAttemptUncheckedUpdateInput,
): Promise<TestAttemptRecord> {
  return prisma.testAttempt.update({
    where: { id },
    data,
    select: attemptSelect,
  });
}

export async function getPracticeAttemptStats(practiceTestId: string, userId: number) {
  const agg = await prisma.testAttempt.aggregate({
    where: { practiceTestId, userId },
    _count: { _all: true },
    _max: { startedAt: true, score: true },
  });
  return {
    attemptCount: agg._count._all ?? 0,
    lastAttemptAt: agg._max.startedAt ?? null,
    bestScore: agg._max.score ?? null,
  };
}

export async function getExamAttemptStats(examTestId: string, userId: number) {
  const agg = await prisma.testAttempt.aggregate({
    where: { examTestId, userId },
    _count: { _all: true },
    _max: { startedAt: true, score: true },
  });
  return {
    attemptCount: agg._count._all ?? 0,
    lastAttemptAt: agg._max.startedAt ?? null,
    bestScore: agg._max.score ?? null,
  };
}

type PerTestAttemptStats = {
  attemptCount: number;
  lastAttemptAt: Date | null;
  bestScore: number | null;
  lastAttemptId: string | null;
  lastAttemptStatus: number | null;
  lastAttemptStartedAt: Date | null;
};

type PracticeStatsSqlRow = {
  practice_test_id: string;
  attempt_count: number;
  last_attempt_at: Date | null;
  best_score: number | null;
  latest_id: string | null;
  latest_status: number | null;
  latest_started_at: Date | null;
};

type ExamStatsSqlRow = {
  exam_test_id: string;
  attempt_count: number;
  last_attempt_at: Date | null;
  best_score: number | null;
  latest_id: string | null;
  latest_status: number | null;
  latest_started_at: Date | null;
};

export async function getPracticeAttemptStatsByUserForTests(practiceTestIds: string[], userId: number) {
  if (!practiceTestIds.length) {
    return new Map<string, PerTestAttemptStats>();
  }

  const rows = await prisma.$queryRaw<PracticeStatsSqlRow[]>`
    WITH agg AS (
      SELECT
        practice_test_id,
        COUNT(*)::int AS attempt_count,
        MAX(started_at) AS last_attempt_at,
        MAX(score) AS best_score
      FROM test_attempts
      WHERE user_id = ${userId}
        AND practice_test_id IN (${Prisma.join(practiceTestIds)})
      GROUP BY practice_test_id
    ),
    latest AS (
      SELECT DISTINCT ON (practice_test_id)
        id AS latest_id,
        practice_test_id,
        status AS latest_status,
        started_at AS latest_started_at
      FROM test_attempts
      WHERE user_id = ${userId}
        AND practice_test_id IN (${Prisma.join(practiceTestIds)})
      ORDER BY practice_test_id, started_at DESC
    )
    SELECT
      agg.practice_test_id,
      agg.attempt_count,
      agg.last_attempt_at,
      agg.best_score,
      latest.latest_id,
      latest.latest_status,
      latest.latest_started_at
    FROM agg
    LEFT JOIN latest ON latest.practice_test_id = agg.practice_test_id
  `;

  logger.debug(
    `[test-attempt.repo] getPracticeAttemptStatsByUserForTests userId=${userId} testCount=${practiceTestIds.length} rowCount=${rows.length}`,
  );

  const map = new Map<string, PerTestAttemptStats>();
  for (const r of rows) {
    map.set(r.practice_test_id, {
      attemptCount: r.attempt_count,
      lastAttemptAt: r.last_attempt_at,
      bestScore: r.best_score,
      lastAttemptId: r.latest_id,
      lastAttemptStatus: r.latest_status,
      lastAttemptStartedAt: r.latest_started_at,
    });
  }
  return map;
}

export async function getExamAttemptStatsByUserForTests(examTestIds: string[], userId: number) {
  if (!examTestIds.length) {
    return new Map<string, PerTestAttemptStats>();
  }

  const rows = await prisma.$queryRaw<ExamStatsSqlRow[]>`
    WITH agg AS (
      SELECT
        exam_test_id,
        COUNT(*)::int AS attempt_count,
        MAX(started_at) AS last_attempt_at,
        MAX(score) AS best_score
      FROM test_attempts
      WHERE user_id = ${userId}
        AND exam_test_id IN (${Prisma.join(examTestIds)})
      GROUP BY exam_test_id
    ),
    latest AS (
      SELECT DISTINCT ON (exam_test_id)
        id AS latest_id,
        exam_test_id,
        status AS latest_status,
        started_at AS latest_started_at
      FROM test_attempts
      WHERE user_id = ${userId}
        AND exam_test_id IN (${Prisma.join(examTestIds)})
      ORDER BY exam_test_id, started_at DESC
    )
    SELECT
      agg.exam_test_id,
      agg.attempt_count,
      agg.last_attempt_at,
      agg.best_score,
      latest.latest_id,
      latest.latest_status,
      latest.latest_started_at
    FROM agg
    LEFT JOIN latest ON latest.exam_test_id = agg.exam_test_id
  `;

  logger.debug(`[test-attempt.repo] getExamAttemptStatsByUserForTests userId=${userId} testCount=${examTestIds.length} rowCount=${rows.length}`);

  const map = new Map<string, PerTestAttemptStats>();
  for (const r of rows) {
    map.set(r.exam_test_id, {
      attemptCount: r.attempt_count,
      lastAttemptAt: r.last_attempt_at,
      bestScore: r.best_score,
      lastAttemptId: r.latest_id,
      lastAttemptStatus: r.latest_status,
      lastAttemptStartedAt: r.latest_started_at,
    });
  }
  return map;
}

export async function upsertAttemptAnswersAndFinalize(params: {
  attemptId: string;
  evaluated: Array<{
    questionId: string;
    selectedOptionIds: string[];
    textAnswer: string | null;
    isCorrect: boolean | null;
    obtainedMarks: number | null;
  }>;
  attemptUpdate: Prisma.TestAttemptUncheckedUpdateInput;
}): Promise<TestAttemptWithAnswers | null> {
  const { attemptId, evaluated, attemptUpdate } = params;

  return prisma.$transaction(async (tx) => {
    await Promise.all(
      evaluated.map((e) =>
        tx.testAttemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: e.questionId } },
          create: {
            attemptId,
            questionId: e.questionId,
            selectedOptionIds: e.selectedOptionIds,
            textAnswer: e.textAnswer,
            isCorrect: e.isCorrect,
            obtainedMarks: e.obtainedMarks,
          },
          update: {
            selectedOptionIds: e.selectedOptionIds,
            textAnswer: e.textAnswer,
            isCorrect: e.isCorrect,
            obtainedMarks: e.obtainedMarks,
          },
        }),
      ),
    );

    await tx.testAttempt.update({
      where: { id: attemptId },
      data: attemptUpdate,
    });

    return tx.testAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
  });
}

export async function getPracticeTestAnalyticsAttempts(
  practiceTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  return prisma.testAttempt.findMany({
    where: {
      practiceTestId,
      status: { in: attemptStatuses },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      totalScore: true,
      percentage: true,
      user: { select: { name: true, email: true } },
    },
  });
}

export async function getExamTestAnalyticsAttempts(
  examTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  return prisma.testAttempt.findMany({
    where: {
      examTestId,
      status: { in: attemptStatuses },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      totalScore: true,
      percentage: true,
      user: { select: { name: true, email: true } },
    },
  });
}

export async function getPracticeTestQuestionIds(practiceTestId: string) {
  const rows = await prisma.testQuestion.findMany({
    where: { practiceTestId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.id);
}

export async function getExamTestQuestionIds(examTestId: string) {
  const rows = await prisma.testQuestion.findMany({
    where: { examTestId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => r.id);
}

export async function getPracticeTestCorrectCountsByQuestion(
  practiceTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  const rows = await prisma.testAttemptAnswer.groupBy({
    by: ['questionId'],
    where: {
      isCorrect: true,
      attempt: {
        practiceTestId,
        status: { in: attemptStatuses },
      },
    },
    _count: { _all: true },
  });
  return rows.map((r) => ({ questionId: r.questionId, correctCount: r._count._all ?? 0 }));
}

export async function getExamTestCorrectCountsByQuestion(
  examTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  const rows = await prisma.testAttemptAnswer.groupBy({
    by: ['questionId'],
    where: {
      isCorrect: true,
      attempt: {
        examTestId,
        status: { in: attemptStatuses },
      },
    },
    _count: { _all: true },
  });
  return rows.map((r) => ({ questionId: r.questionId, correctCount: r._count._all ?? 0 }));
}

export async function getPracticeTestAnalyticsAttemptsForExport(
  practiceTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  return prisma.testAttempt.findMany({
    where: {
      practiceTestId,
      status: { in: attemptStatuses },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      totalScore: true,
      percentage: true,
      user: { select: { name: true, email: true } },
    },
  });
}

export async function getExamTestAnalyticsAttemptsForExport(
  examTestId: string,
  attemptStatuses: number[],
) {
  if (!attemptStatuses.length) return [];
  return prisma.testAttempt.findMany({
    where: {
      examTestId,
      status: { in: attemptStatuses },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      totalScore: true,
      percentage: true,
      user: { select: { name: true, email: true } },
    },
  });
}

/** Minimal batch id in (test.batchIds ∩ user's active batch memberships), per product rules. */
export function computeLowestEligibleBatchId(testBatchIds: number[], userActiveBatchIds: number[]): number | null {
  const userSet = new Set(userActiveBatchIds);
  let min: number | null = null;
  for (const bid of testBatchIds) {
    if (userSet.has(bid)) {
      if (min === null || bid < min) min = bid;
    }
  }
  return min;
}

export type ExamRankDerivedBatchRow = {
  rank_in_batch: number;
  total_in_batch: number;
  eligible_batch_id: number;
};

/**
 * Rank among submitted exam attempts for users sharing the same derived eligible batch
 * (lowest batch id in test.batch ∩ user's active batches). Ties: higher score first, then lower userId.
 */
export async function getExamRankForUserDerivedBatch(examTestId: string, userId: number): Promise<{
  rankInBatch: number;
  totalStudentsInBatch: number;
  eligibleBatchId: number;
} | null> {
  const rows = await prisma.$queryRaw<ExamRankDerivedBatchRow[]>`
    WITH et AS (
      SELECT batch_ids
      FROM exam_tests
      WHERE id = ${examTestId}
    ),
    user_eligible AS (
      SELECT (
        SELECT MIN(bid)
        FROM unnest((SELECT batch_ids FROM et)) AS bid
        WHERE EXISTS (
          SELECT 1 FROM batch_users bu
          WHERE bu.user_id = ${userId}
            AND bu.batch_id = bid
            AND bu.is_active = true
        )
      ) AS eligible_batch_id
    ),
    per_user_best AS (
      SELECT ta.user_id, MAX(ta.score) AS best_score
      FROM test_attempts ta
      WHERE ta.exam_test_id = ${examTestId}
        AND ta.status IN (1, 2)
      GROUP BY ta.user_id
    ),
    eligible_scores AS (
      SELECT
        p.user_id,
        p.best_score AS score,
        (
          SELECT MIN(bid)
          FROM unnest((SELECT batch_ids FROM et)) AS bid
          WHERE EXISTS (
            SELECT 1 FROM batch_users bu
            WHERE bu.user_id = p.user_id
              AND bu.batch_id = bid
              AND bu.is_active = true
          )
        ) AS eligible_batch_id
      FROM per_user_best p
    ),
    filtered AS (
      SELECT es.user_id, es.score
      FROM eligible_scores es
      CROSS JOIN user_eligible ue
      WHERE es.eligible_batch_id IS NOT NULL
        AND ue.eligible_batch_id IS NOT NULL
        AND es.eligible_batch_id = ue.eligible_batch_id
    ),
    ranked AS (
      SELECT
        user_id,
        RANK() OVER (ORDER BY score DESC NULLS LAST, user_id ASC) AS rnk,
        COUNT(*) OVER () AS cnt
      FROM filtered
    )
    SELECT
      r.rnk::int AS rank_in_batch,
      r.cnt::int AS total_in_batch,
      ue.eligible_batch_id::int AS eligible_batch_id
    FROM ranked r
    CROSS JOIN user_eligible ue
    WHERE r.user_id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  logger.debug(
    `[test-attempt.repo] getExamRankForUserDerivedBatch examTestId=${examTestId} userId=${userId} rank=${row.rank_in_batch} total=${row.total_in_batch} eligibleBatchId=${row.eligible_batch_id}`,
  );
  return {
    rankInBatch: row.rank_in_batch,
    totalStudentsInBatch: row.total_in_batch,
    eligibleBatchId: row.eligible_batch_id,
  };
}

