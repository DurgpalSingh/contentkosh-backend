import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { TestStatus } from '../constants/test-enums';

const practiceTestSelect = {
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
  defaultMarksPerQuestion: true,
  showExplanations: true,
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

export interface PracticeTestFindOptions {
  where?: Prisma.PracticeTestWhereInput;
  orderBy?: Prisma.PracticeTestOrderByWithRelationInput;
  skip?: number;
  take?: number;
  select?: Prisma.PracticeTestSelect;
  include?: Prisma.PracticeTestInclude;
}

export function createPracticeTest(data: Prisma.PracticeTestUncheckedCreateInput) {
  return prisma.practiceTest.create({
    data,
    select: practiceTestSelect,
  });
}

export function findPracticeTestById(
  businessId: number,
  id: string,
  options: PracticeTestFindOptions = {},
) {
  const query: Prisma.PracticeTestFindFirstArgs = { where: { id, businessId } };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = practiceTestSelect;

  return prisma.practiceTest.findFirst(query);
}

export function findPracticeTestByIdForUser(
  businessId: number,
  id: string,
  userActiveBatchIds: number[],
  options: PracticeTestFindOptions = {},
) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve(null);
  }
  const query: Prisma.PracticeTestFindFirstArgs = {
    where: {
      id,
      businessId,
      batchIds: { hasSome: userActiveBatchIds },
    },
  };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = practiceTestSelect;

  return prisma.practiceTest.findFirst(query);
}

export function findPracticeTestsByBusinessId(
  businessId: number,
  options: PracticeTestFindOptions = {},
) {
  const query: Prisma.PracticeTestFindManyArgs = {
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
  else query.select = practiceTestSelect as Prisma.PracticeTestSelect;

  return prisma.practiceTest.findMany(query);
}

export function findPracticeTestsByBusinessIdForUser(
  businessId: number,
  userActiveBatchIds: number[],
  options: PracticeTestFindOptions = {},
) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve([]);
  }
  const query: Prisma.PracticeTestFindManyArgs = {
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
  else query.select = practiceTestSelect as Prisma.PracticeTestSelect;

  return prisma.practiceTest.findMany(query);
}

export function updatePracticeTest(
  businessId: number,
  id: string,
  data: Prisma.PracticeTestUncheckedUpdateInput,
) {
  return prisma.practiceTest.update({
    where: { id, businessId },
    data,
    select: practiceTestSelect,
  });
}

export function deletePracticeTest(businessId: number, id: string) {
  return prisma.practiceTest.deleteMany({
    where: { id, businessId },
  });
}

export function findPublishedPracticeTestsForStudent(businessId: number, userActiveBatchIds: number[]) {
  if (!userActiveBatchIds.length) {
    return Promise.resolve([]);
  }
  return prisma.practiceTest.findMany({
    where: {
      businessId,
      status: TestStatus.PUBLISHED,
      batchIds: { hasSome: userActiveBatchIds },
    },
    select: practiceTestSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function countPracticeTestAttempts(practiceTestId: string): Promise<number> {
  const c = await prisma.testAttempt.count({
    where: { practiceTestId },
  });
  return c;
}
