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

  const optionsData = data.options?.length
    ? {
        options: {
          create: data.options.map((o) => ({
            text: o.text,
            mediaUrl: o.mediaUrl ?? null,
          })),
        },
      }
    : {};

  return prisma.testQuestion.create({
    data: { ...createData, ...optionsData },
    select: questionSelect,
  });
}

function resolveCorrectOptionIds(params: {
  options: Array<{ id: string }>;
  correctRefs: Array<string | number>;
}): string[] {
  const { options, correctRefs } = params;
  if (!correctRefs.length) return [];

  const allNumeric = correctRefs.every((r) => typeof r === 'number' || (typeof r === 'string' && /^\d+$/.test(r)));
  if (!allNumeric) {
    // assume already option ids
    return correctRefs.map(String);
  }

  const nums = correctRefs.map((r) => Number(r));
  const looksOneBased = nums.every((n) => Number.isInteger(n) && n >= 1) && !nums.includes(0);
  const idxs = nums.map((n) => (looksOneBased ? n - 1 : n));

  const resolved: string[] = [];
  for (const idx of idxs) {
    const opt = options[idx];
    if (!opt) continue;
    resolved.push(opt.id);
  }
  return resolved;
}

export async function createPracticeTestQuestionResolvingCorrect(
  businessId: number,
  practiceTestId: string,
  data: {
    type: number;
    text: string;
    mediaUrl?: string | null;
    explanation?: string | null;
    correctTextAnswer?: string | null;
    correctOptionRefs?: Array<string | number>;
    options?: Array<{ text: string; mediaUrl?: string | null }>;
  },
) {
  const parent = await prisma.practiceTest.findFirst({
    where: { id: practiceTestId, businessId },
    select: { id: true },
  });
  if (!parent) return null;

  return prisma.$transaction(async (tx) => {
    const created = await tx.testQuestion.create({
      data: {
        practiceTest: { connect: { id: practiceTestId } },
        type: data.type,
        text: data.text,
        mediaUrl: data.mediaUrl ?? null,
        explanation: data.explanation ?? null,
        correctTextAnswer: data.correctTextAnswer ?? null,
        correctOptionIdsAnswers: [],
        ...(data.options?.length
          ? {
              options: {
                create: data.options.map((o) => ({
                  text: o.text,
                  mediaUrl: o.mediaUrl ?? null,
                })),
              },
            }
          : {}),
      },
      select: questionSelect,
    });

    const correctOptionIdsAnswers = resolveCorrectOptionIds({
      options: created.options ?? [],
      correctRefs: data.correctOptionRefs ?? [],
    });

    if (correctOptionIdsAnswers.length) {
      return tx.testQuestion.update({
        where: { id: created.id },
        data: { correctOptionIdsAnswers },
        select: questionSelect,
      });
    }

    return created;
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

  const optionsData = data.options?.length
    ? {
        options: {
          create: data.options.map((o) => ({
            text: o.text,
            mediaUrl: o.mediaUrl ?? null,
          })),
        },
      }
    : {};

  return prisma.testQuestion.create({
    data: { ...createData, ...optionsData },
    select: questionSelect,
  });
}

export async function createExamTestQuestionResolvingCorrect(
  businessId: number,
  examTestId: string,
  data: {
    type: number;
    text: string;
    mediaUrl?: string | null;
    explanation?: string | null;
    correctTextAnswer?: string | null;
    correctOptionRefs?: Array<string | number>;
    options?: Array<{ text: string; mediaUrl?: string | null }>;
  },
) {
  const parent = await prisma.examTest.findFirst({
    where: { id: examTestId, businessId },
    select: { id: true },
  });
  if (!parent) return null;

  return prisma.$transaction(async (tx) => {
    const created = await tx.testQuestion.create({
      data: {
        examTest: { connect: { id: examTestId } },
        type: data.type,
        text: data.text,
        mediaUrl: data.mediaUrl ?? null,
        explanation: data.explanation ?? null,
        correctTextAnswer: data.correctTextAnswer ?? null,
        correctOptionIdsAnswers: [],
        ...(data.options?.length
          ? {
              options: {
                create: data.options.map((o) => ({
                  text: o.text,
                  mediaUrl: o.mediaUrl ?? null,
                })),
              },
            }
          : {}),
      },
      select: questionSelect,
    });

    const correctOptionIdsAnswers = resolveCorrectOptionIds({
      options: created.options ?? [],
      correctRefs: data.correctOptionRefs ?? [],
    });

    if (correctOptionIdsAnswers.length) {
      return tx.testQuestion.update({
        where: { id: created.id },
        data: { correctOptionIdsAnswers },
        select: questionSelect,
      });
    }

    return created;
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

