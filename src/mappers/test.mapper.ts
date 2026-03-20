import { TestStatus } from '../constants/test-enums';

export type PracticeTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status: number;
  isPublished: boolean;
  defaultMarksPerQuestion: number;
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionCount: number;
  totalQuestions: number;
  totalMarks: number;
  createdBy: number;
  updatedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExamTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status: number;
  isPublished: boolean;
  startAt: Date;
  deadlineAt: Date;
  durationMinutes: number;
  defaultMarksPerQuestion: number;
  negativeMarksPerQuestion: number;
  resultVisibility: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionCount: number;
  totalQuestions: number;
  totalMarks: number;
  createdBy: number;
  updatedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TestOptionResponse = {
  id: string;
  text: string;
  mediaUrl?: string | null;
};

export type TestQuestionResponse = {
  id: string;
  type: number;
  questionText: string;
  mediaUrl?: string | null;
  options: TestOptionResponse[];
};

export type PracticeAvailableTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status?: number;
  totalQuestions: number;
  totalMarks: number;
  defaultMarksPerQuestion?: number;
  canAttempt?: boolean;
  attemptCount?: number;
  bestScore?: number | null;
  lastAttemptAt?: Date | null;
};

export type ExamAvailableTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status?: number;
  startAt: Date;
  deadlineAt: Date;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  defaultMarksPerQuestion?: number;
  negativeMarksPerQuestion?: number;
  resultVisibility?: number;
  canAttempt?: boolean;
  lockedReason?: number | null;
  attemptsAllowed?: number;
  attemptsUsed?: number;
  hasAttempt?: boolean;
  lastAttemptAt?: Date | null;
};

type TestCountCarrier = {
  _count?: {
    questions?: number;
  };
  totalQuestions?: number;
};

function resolveTotalQuestions(t: TestCountCarrier): number {
  return t.totalQuestions ?? t._count?.questions ?? 0;
}

export const TestMapper = {
  practiceTest(t: {
    id: string;
    businessId: number;
    batchId: number;
    name: string;
    description?: string | null;
    status: number;
    defaultMarksPerQuestion: number;
    showExplanations: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    createdBy: number;
    updatedBy?: number | null;
    createdAt: Date;
    updatedAt: Date;
  } & TestCountCarrier): PracticeTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      isPublished: t.status === TestStatus.PUBLISHED,
      defaultMarksPerQuestion: t.defaultMarksPerQuestion,
      showExplanations: t.showExplanations,
      shuffleQuestions: t.shuffleQuestions,
      shuffleOptions: t.shuffleOptions,
      questionCount: totalQuestions,
      totalQuestions,
      totalMarks,
      createdBy: t.createdBy,
      updatedBy: t.updatedBy ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  examTest(t: {
    id: string;
    businessId: number;
    batchId: number;
    name: string;
    description?: string | null;
    status: number;
    startAt: Date;
    deadlineAt: Date;
    durationMinutes: number;
    defaultMarksPerQuestion: number;
    negativeMarksPerQuestion: number;
    resultVisibility: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    createdBy: number;
    updatedBy?: number | null;
    createdAt: Date;
    updatedAt: Date;
  } & TestCountCarrier): ExamTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      isPublished: t.status === TestStatus.PUBLISHED,
      startAt: t.startAt,
      deadlineAt: t.deadlineAt,
      durationMinutes: t.durationMinutes,
      defaultMarksPerQuestion: t.defaultMarksPerQuestion,
      negativeMarksPerQuestion: t.negativeMarksPerQuestion,
      resultVisibility: t.resultVisibility,
      shuffleQuestions: t.shuffleQuestions,
      shuffleOptions: t.shuffleOptions,
      questionCount: totalQuestions,
      totalQuestions,
      totalMarks,
      createdBy: t.createdBy,
      updatedBy: t.updatedBy ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  question(q: {
    id: string;
    type: number;
    text: string;
    mediaUrl?: string | null;
    options?: Array<{ id: string; text: string; mediaUrl?: string | null }>;
  }): TestQuestionResponse {
    return {
      id: q.id,
      type: q.type,
      questionText: q.text,
      mediaUrl: q.mediaUrl ?? null,
      options: (q.options ?? []).map((o) => ({
        id: o.id,
        text: o.text,
        mediaUrl: o.mediaUrl ?? null,
      })),
    };
  },

  practiceAvailableTest(
    t: {
      id: string;
      businessId: number;
      batchId: number;
      name: string;
      description?: string | null;
      status?: number;
      defaultMarksPerQuestion?: number;
    } & TestCountCarrier,
    stats?: { attemptCount?: number; bestScore?: number | null; lastAttemptAt?: Date | null; canAttempt?: boolean },
  ): PracticeAvailableTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    const base: PracticeAvailableTestResponse = {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      totalQuestions,
      totalMarks,
    };

    return {
      ...base,
      ...(t.status !== undefined ? { status: t.status } : {}),
      ...(t.defaultMarksPerQuestion !== undefined ? { defaultMarksPerQuestion: t.defaultMarksPerQuestion } : {}),
      ...(stats?.canAttempt !== undefined ? { canAttempt: stats.canAttempt } : {}),
      ...(stats?.attemptCount !== undefined ? { attemptCount: stats.attemptCount } : {}),
      ...(stats?.bestScore !== undefined ? { bestScore: stats.bestScore ?? null } : {}),
      ...(stats?.lastAttemptAt !== undefined ? { lastAttemptAt: stats.lastAttemptAt ?? null } : {}),
    };
  },

  examAvailableTest(
    t: {
      id: string;
      businessId: number;
      batchId: number;
      name: string;
      description?: string | null;
      status?: number;
      startAt: Date;
      deadlineAt: Date;
      durationMinutes: number;
      defaultMarksPerQuestion?: number;
      negativeMarksPerQuestion?: number;
      resultVisibility?: number;
    } & TestCountCarrier,
    stats?: {
      canAttempt?: boolean;
      lockedReason?: number | null;
      attemptsAllowed?: number;
      attemptsUsed?: number;
      hasAttempt?: boolean;
      lastAttemptAt?: Date | null;
    },
  ): ExamAvailableTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    const base: ExamAvailableTestResponse = {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      startAt: t.startAt,
      deadlineAt: t.deadlineAt,
      durationMinutes: t.durationMinutes,
      totalQuestions,
      totalMarks,
    };

    return {
      ...base,
      ...(t.status !== undefined ? { status: t.status } : {}),
      ...(t.defaultMarksPerQuestion !== undefined ? { defaultMarksPerQuestion: t.defaultMarksPerQuestion } : {}),
      ...(t.negativeMarksPerQuestion !== undefined ? { negativeMarksPerQuestion: t.negativeMarksPerQuestion } : {}),
      ...(t.resultVisibility !== undefined ? { resultVisibility: t.resultVisibility } : {}),
      ...(stats?.canAttempt !== undefined ? { canAttempt: stats.canAttempt } : {}),
      ...(stats?.lockedReason !== undefined ? { lockedReason: stats.lockedReason ?? null } : {}),
      ...(stats?.attemptsAllowed !== undefined ? { attemptsAllowed: stats.attemptsAllowed } : {}),
      ...(stats?.attemptsUsed !== undefined ? { attemptsUsed: stats.attemptsUsed } : {}),
      ...(stats?.hasAttempt !== undefined ? { hasAttempt: stats.hasAttempt } : {}),
      ...(stats?.lastAttemptAt !== undefined ? { lastAttemptAt: stats.lastAttemptAt ?? null } : {}),
    };
  },
};

