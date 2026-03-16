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

export interface TestAttemptFindOptions {
  where?: Prisma.TestAttemptWhereInput;
  orderBy?: Prisma.TestAttemptOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.TestAttemptSelect;
  include?: Prisma.TestAttemptInclude;
}

export function createTestAttempt(data: Prisma.TestAttemptUncheckedCreateInput) {
  return prisma.testAttempt.create({
    data,
    select: attemptSelect,
  });
}

export function findTestAttemptById(
  id: string,
  options: TestAttemptFindOptions = {},
) {
  const query: any = { where: { id } };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = attemptSelect;

  return prisma.testAttempt.findUnique(query);
}

export function findPracticeAttemptsByUser(
  practiceTestId: string,
  userId: number,
  options: TestAttemptFindOptions = {},
) {
  const query: Prisma.TestAttemptFindManyArgs = {
    where: { practiceTestId, userId, ...(options.where ?? {}) },
    orderBy: options.orderBy ?? { startedAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else (query as any).select = attemptSelect;

  return prisma.testAttempt.findMany(query);
}

export function findExamAttemptsByUser(
  examTestId: string,
  userId: number,
  options: TestAttemptFindOptions = {},
) {
  const query: Prisma.TestAttemptFindManyArgs = {
    where: { examTestId, userId, ...(options.where ?? {}) },
    orderBy: options.orderBy ?? { startedAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else (query as any).select = attemptSelect;

  return prisma.testAttempt.findMany(query);
}

export function updateTestAttempt(
  id: string,
  data: Prisma.TestAttemptUncheckedUpdateInput,
) {
  return prisma.testAttempt.update({
    where: { id },
    data,
    select: attemptSelect,
  });
}

