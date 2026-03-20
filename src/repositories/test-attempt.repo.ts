import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

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

export function findTestAttemptById<T extends Omit<Prisma.TestAttemptFindUniqueArgs, 'where'>>(
  id: string,
  options?: T,
): Promise<Prisma.TestAttemptGetPayload<{ where: { id: string } } & T> | null> {
  const query: Prisma.TestAttemptFindUniqueArgs = { where: { id }, ...(options ?? {}) };
  if (!query.select && !query.include) query.select = attemptSelect;
  return prisma.testAttempt.findUnique(query) as Promise<Prisma.TestAttemptGetPayload<{ where: { id: string } } & T> | null>;
}

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

export async function getPracticeAttemptStatsByUserForTests(practiceTestIds: string[], userId: number) {
  if (!practiceTestIds.length) {
    return new Map<
      string,
      { attemptCount: number; lastAttemptAt: Date | null; bestScore: number | null; lastAttemptId: string | null }
    >();
  }
  const rows = await prisma.testAttempt.groupBy({
    by: ['practiceTestId'],
    where: { userId, practiceTestId: { in: practiceTestIds } },
    _count: { _all: true },
    _max: { startedAt: true, score: true },
  });
  const map = new Map<string, { attemptCount: number; lastAttemptAt: Date | null; bestScore: number | null; lastAttemptId: string | null }>();
  rows.forEach((r) => {
    if (!r.practiceTestId) return;
    map.set(r.practiceTestId, {
      attemptCount: r._count._all ?? 0,
      lastAttemptAt: r._max.startedAt ?? null,
      bestScore: r._max.score ?? null,
      lastAttemptId: null,
    });
  });

  const latestAttempts = await prisma.testAttempt.findMany({
    where: { userId, practiceTestId: { in: practiceTestIds } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, practiceTestId: true, startedAt: true },
  });
  for (const row of latestAttempts) {
    if (!row.practiceTestId) continue;
    const entry = map.get(row.practiceTestId);
    if (!entry || entry.lastAttemptId) continue;
    entry.lastAttemptId = row.id;
  }

  return map;
}

export async function getExamAttemptStatsByUserForTests(examTestIds: string[], userId: number) {
  if (!examTestIds.length) {
    return new Map<
      string,
      { attemptCount: number; lastAttemptAt: Date | null; bestScore: number | null; lastAttemptId: string | null }
    >();
  }
  const rows = await prisma.testAttempt.groupBy({
    by: ['examTestId'],
    where: { userId, examTestId: { in: examTestIds } },
    _count: { _all: true },
    _max: { startedAt: true, score: true },
  });
  const map = new Map<string, { attemptCount: number; lastAttemptAt: Date | null; bestScore: number | null; lastAttemptId: string | null }>();
  rows.forEach((r) => {
    if (!r.examTestId) return;
    map.set(r.examTestId, {
      attemptCount: r._count._all ?? 0,
      lastAttemptAt: r._max.startedAt ?? null,
      bestScore: r._max.score ?? null,
      lastAttemptId: null,
    });
  });

  const latestAttempts = await prisma.testAttempt.findMany({
    where: { userId, examTestId: { in: examTestIds } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, examTestId: true, startedAt: true },
  });
  for (const row of latestAttempts) {
    if (!row.examTestId) continue;
    const entry = map.get(row.examTestId);
    if (!entry || entry.lastAttemptId) continue;
    entry.lastAttemptId = row.id;
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
}) {
  const { attemptId, evaluated, attemptUpdate } = params;

  await prisma.$transaction(async (tx) => {
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

