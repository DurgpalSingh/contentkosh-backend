import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const questionSelect = {
  id: true,
  practiceTestId: true,
  examTestId: true,
  type: true,
  text: true,
  correctTextAnswer: true,
  correctOptionIdsAnswers: true,
  explanation: true,
  mediaUrl: true,
  createdAt: true,
  updatedAt: true,
  options: {
    select: {
      id: true,
      questionId: true,
      text: true,
      mediaUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

export function listPracticeTestQuestions(businessId: number, practiceTestId: string) {
  return prisma.testQuestion.findMany({
    where: {
      practiceTestId,
      practiceTest: { businessId },
    },
    select: questionSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export function listExamTestQuestions(businessId: number, examTestId: string) {
  return prisma.testQuestion.findMany({
    where: {
      examTestId,
      examTest: { businessId },
    },
    select: questionSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export function findQuestionById(businessId: number, questionId: string) {
  return prisma.testQuestion.findFirst({
    where: {
      id: questionId,
      OR: [
        { practiceTest: { businessId } },
        { examTest: { businessId } },
      ],
    },
    select: questionSelect,
  });
}

export async function createPracticeTestQuestion(
  businessId: number,
  practiceTestId: string,
  data: {
    type: number;
    text: string;
    mediaUrl?: string | null;
    explanation?: string | null;
    correctTextAnswer?: string | null;
    correctOptionIdsAnswers?: string[];
    options?: Array<{ text: string; mediaUrl?: string | null }>;
  },
) {
  // Ensure parent exists & is scoped to business
  const parent = await prisma.practiceTest.findFirst({
    where: { id: practiceTestId, businessId },
    select: { id: true },
  });
  if (!parent) return null;

  const createData: Prisma.TestQuestionCreateInput = {
    practiceTest: { connect: { id: practiceTestId } },
    type: data.type,
    text: data.text,
    mediaUrl: data.mediaUrl ?? null,
    explanation: data.explanation ?? null,
    correctTextAnswer: data.correctTextAnswer ?? null,
    correctOptionIdsAnswers: data.correctOptionIdsAnswers ?? [],
  };

  if (data.options?.length) {
    (createData as any).options = {
      create: data.options.map((o) => ({
        text: o.text,
        mediaUrl: o.mediaUrl ?? null,
      })),
    };
  }

  return prisma.testQuestion.create({
    data: createData,
    select: questionSelect,
  });
}

export async function createExamTestQuestion(
  businessId: number,
  examTestId: string,
  data: {
    type: number;
    text: string;
    mediaUrl?: string | null;
    explanation?: string | null;
    correctTextAnswer?: string | null;
    correctOptionIdsAnswers?: string[];
    options?: Array<{ text: string; mediaUrl?: string | null }>;
  },
) {
  const parent = await prisma.examTest.findFirst({
    where: { id: examTestId, businessId },
    select: { id: true },
  });
  if (!parent) return null;

  const createData: Prisma.TestQuestionCreateInput = {
    examTest: { connect: { id: examTestId } },
    type: data.type,
    text: data.text,
    mediaUrl: data.mediaUrl ?? null,
    explanation: data.explanation ?? null,
    correctTextAnswer: data.correctTextAnswer ?? null,
    correctOptionIdsAnswers: data.correctOptionIdsAnswers ?? [],
  };

  if (data.options?.length) {
    (createData as any).options = {
      create: data.options.map((o) => ({
        text: o.text,
        mediaUrl: o.mediaUrl ?? null,
      })),
    };
  }

  return prisma.testQuestion.create({
    data: createData,
    select: questionSelect,
  });
}

export async function updateQuestionAndOptions(
  businessId: number,
  questionId: string,
  data: {
    type?: number;
    text?: string;
    mediaUrl?: string | null;
    explanation?: string | null;
    correctTextAnswer?: string | null;
    correctOptionIdsAnswers?: string[];
    options?: Array<{ id?: string; text: string; mediaUrl?: string | null }>;
  },
) {
  const existing = await findQuestionById(businessId, questionId);
  if (!existing) return null;

  // If options provided, replace options set (simplest, consistent semantics)
  const shouldReplaceOptions = Array.isArray(data.options);

  return prisma.$transaction(async (tx) => {
    if (shouldReplaceOptions) {
      await tx.testOption.deleteMany({ where: { questionId } });
    }

    const updated = await tx.testQuestion.update({
      where: { id: questionId },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.text !== undefined ? { text: data.text } : {}),
        ...(data.mediaUrl !== undefined ? { mediaUrl: data.mediaUrl } : {}),
        ...(data.explanation !== undefined ? { explanation: data.explanation } : {}),
        ...(data.correctTextAnswer !== undefined ? { correctTextAnswer: data.correctTextAnswer } : {}),
        ...(data.correctOptionIdsAnswers !== undefined ? { correctOptionIdsAnswers: data.correctOptionIdsAnswers } : {}),
        ...(shouldReplaceOptions
          ? {
              options: {
                create: (data.options ?? []).map((o) => ({
                  text: o.text,
                  mediaUrl: o.mediaUrl ?? null,
                })),
              },
            }
          : {}),
      },
      select: questionSelect,
    });

    return updated;
  });
}

export async function deleteQuestion(businessId: number, questionId: string) {
  const existing = await findQuestionById(businessId, questionId);
  if (!existing) return null;

  return prisma.testQuestion.delete({
    where: { id: questionId },
    select: { id: true },
  });
}

export function countQuestionsForPracticeTest(businessId: number, practiceTestId: string) {
  return prisma.testQuestion.count({
    where: {
      practiceTestId,
      practiceTest: { businessId },
    },
  });
}

export function countQuestionsForExamTest(businessId: number, examTestId: string) {
  return prisma.testQuestion.count({
    where: {
      examTestId,
      examTest: { businessId },
    },
  });
}

export function hasAttemptsForPracticeTest(businessId: number, practiceTestId: string) {
  return prisma.testAttempt.count({
    where: { practiceTestId, practiceTest: { businessId } },
  }).then((c) => c > 0);
}

export function hasAttemptsForExamTest(businessId: number, examTestId: string) {
  return prisma.testAttempt.count({
    where: { examTestId, examTest: { businessId } },
  }).then((c) => c > 0);
}

