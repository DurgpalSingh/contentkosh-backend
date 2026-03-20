import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const practiceTestSelect = {
  id: true,
  businessId: true,
  batchId: true,
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
  const query: any = { where: { id, businessId } };

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else query.select = practiceTestSelect;

  return prisma.practiceTest.findFirst(query);
}

export function findPracticeTestByIdForUser(
  businessId: number,
  id: string,
  userId: number,
  options: PracticeTestFindOptions = {},
) {
  const query: any = {
    where: {
      id,
      businessId,
      batch: {
        batchUsers: {
          some: { userId, isActive: true },
        },
      },
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
  else (query as any).select = practiceTestSelect;

  return prisma.practiceTest.findMany(query);
}

export function findPracticeTestsByBusinessIdForUser(
  businessId: number,
  userId: number,
  options: PracticeTestFindOptions = {},
) {
  const query: Prisma.PracticeTestFindManyArgs = {
    where: {
      businessId,
      batch: {
        batchUsers: {
          some: { userId, isActive: true },
        },
      },
      ...(options.where ?? {}),
    },
    orderBy: options.orderBy ?? { createdAt: 'desc' },
  };

  if (options.skip !== undefined) query.skip = options.skip;
  if (options.take !== undefined) query.take = options.take;

  if (options.select) query.select = options.select;
  else if (options.include) query.include = options.include;
  else (query as any).select = practiceTestSelect;

  return prisma.practiceTest.findMany(query);
}

export function updatePracticeTest(
  businessId: number,
  id: string,
  data: Prisma.PracticeTestUncheckedUpdateInput,
) {
  return prisma.practiceTest
    .updateMany({
      where: { id, businessId },
      data,
    })
    .then(async (r) => (r.count ? findPracticeTestById(businessId, id) : null));
}

export function deletePracticeTest(businessId: number, id: string) {
  return prisma.practiceTest.deleteMany({
    where: { id, businessId },
  });
}

export function findPublishedPracticeTestsForStudent(businessId: number, userId: number) {
  return prisma.practiceTest.findMany({
    where: {
      status: 1,
      batch: {
        course: {
          exam: { businessId },
        },
        batchUsers: {
          some: {
            userId,
            isActive: true,
          },
        },
      },
    },
    select: practiceTestSelect,
    orderBy: { createdAt: 'desc' },
  });
}

