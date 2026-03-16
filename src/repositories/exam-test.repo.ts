import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const examTestSelect = {
  id: true,
  businessId: true,
  batchId: true,
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
  const query: any = { where: { id, businessId } };

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
  else (query as any).select = examTestSelect;

  return prisma.examTest.findMany(query);
}

export function updateExamTest(
  businessId: number,
  id: string,
  data: Prisma.ExamTestUncheckedUpdateInput,
) {
  return prisma.examTest
    .updateMany({
      where: { id, businessId },
      data,
    })
    .then(async (r) => (r.count ? findExamTestById(businessId, id) : null));
}

export function deleteExamTest(businessId: number, id: string) {
  return prisma.examTest.deleteMany({
    where: { id, businessId },
  });
}

