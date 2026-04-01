import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { TestStatus } from '../constants/test-enums';

const examTestSelect = {
  id: true,
  businessId: true,
  batchIds: true,
  subjectId: true,
  subject: {
    select: {
      id: true,
      name: true,
    },
  },
  name: true,
  description: true,
  status: true,
  startAt: true,
  deadlineAt: true,
  durationMinutes: true,
  defaultMarksPerQuestion: true,
  negativeMarksPerQuestion: true,
  resultVisibility: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      questions: true,
    },
  },
};

export interface ExamTestFindOptions {
  where?: Prisma.ExamTestWhereInput;
  orderBy?: Prisma.ExamTestOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.ExamTestSelect;
  include?: Prisma.ExamTestInclude;
}

export function createExamTest(data: Prisma.ExamTestUncheckedCreateInput) {
  return prisma.examTest.create({
    data,
    select: examTestSelect,
  });
}

export function findExamTestById(
  businessId: number,
  id: string,
  options: ExamTestFindOptions = {},
) {
  const query: Prisma.ExamTestFindFirstArgs = { where: { id, businessId } };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = examTestSelect;

  return prisma.examTest.findFirst(query);
}

export function findExamTestByIdForUser(
  businessId: number,
  id: string,
  userActiveBatchIds: number[],
  options: ExamTestFindOptions = {},
) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve(null);
  }
  const query: Prisma.ExamTestFindFirstArgs = {
    where: {
      id,
      businessId,
      batchIds: { hasSome: userActiveBatchIds },
    },
  };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = examTestSelect;

  return prisma.examTest.findFirst(query);
}

export function findExamTestsByBusinessId(
  businessId: number,
  options: ExamTestFindOptions = {},
) {
  const query: Prisma.ExamTestFindManyArgs = {
    where: {
      businessId,
      ...(options.where ?? {}),
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = examTestSelect as Prisma.ExamTestSelect;

  return prisma.examTest.findMany(query);
}

export function findExamTestsByBusinessIdForUser(
  businessId: number,
  userActiveBatchIds: number[],
  options: ExamTestFindOptions = {},
) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve([]);
  }
  const query: Prisma.ExamTestFindManyArgs = {
    where: {
      businessId,
      batchIds: { hasSome: userActiveBatchIds },
      ...(options.where ?? {}),
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = examTestSelect as Prisma.ExamTestSelect;

  return prisma.examTest.findMany(query);
}

export function updateExamTest(businessId: number, id: string, data: Prisma.ExamTestUncheckedUpdateInput) {
  return prisma.examTest.update({
    where: { id, businessId },
    data,
    select: examTestSelect,
  });
}

export function deleteExamTest(businessId: number, id: string) {
  return prisma.examTest.deleteMany({
    where: { id, businessId },
  });
}

export function findPublishedExamTestsForStudent(businessId: number, userActiveBatchIds: number[]) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve([]);
  }
  return prisma.examTest.findMany({
    where: {
      businessId,
      status: TestStatus.PUBLISHED,
      batchIds: { hasSome: userActiveBatchIds },
    },
    select: examTestSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function countExamTestAttempts(examTestId: string): Promise<number> {
  return prisma.testAttempt.count({
    where: { examTestId },
  });
}
