import type { TestAttemptAnswer } from '@prisma/client';
import { TestStatus } from '../constants/test-enums';

export type PracticeTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  /** Batch display name when loaded via batch join (list/get). */
  batchName?: string;
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
  /** Batch display name when loaded via batch join (list/get). */
  batchName?: string;
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
  correctTextAnswer?: string | null;
  explanation?: string | null;
  correctOptionIdsAnswers?: string[];
  options: TestOptionResponse[];
};

/** One row in GET attempt detail: question + student answer + optional correct solution. */
export type StudentAttemptAnswerPayload = {
  selectedOptionIds: string[];
  textAnswer: string | null;
  isCorrect: boolean | null;
  obtainedMarks: number | null;
};

export type StudentAttemptCorrectPayload = {
  correctOptionIds: string[];
  correctTextAnswer: string | null;
};

export type StudentAttemptQuestionResponse = {
  question: TestQuestionResponse;
  studentAnswer: StudentAttemptAnswerPayload | null;
  correctAnswer: StudentAttemptCorrectPayload | null;
};

export type PracticeAvailableTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  /** Human-readable batch name for UI (student available list). */
  batchName?: string;
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
  batchName?: string;
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

type BatchNameCarrier = {
  batch?: {
    displayName: string;
  } | null;
};

type QuestionForStudentAttemptRow = {
  id: string;
  type: number;
  text: string;
  mediaUrl?: string | null;
  options: Array<{ id: string; text: string; mediaUrl?: string | null }>;
  correctOptionIdsAnswers?: string[] | null;
  correctTextAnswer?: string | null;
};

function mapStudentAnswerPayload(
  answerRow: TestAttemptAnswer | undefined,
  includeScoring: boolean,
): StudentAttemptAnswerPayload | null {
  if (!answerRow) return null;
  return {
    selectedOptionIds: answerRow.selectedOptionIds ?? [],
    textAnswer: answerRow.textAnswer ?? null,
    isCorrect: includeScoring ? (answerRow.isCorrect ?? null) : null,
    obtainedMarks: includeScoring ? (answerRow.obtainedMarks ?? null) : null,
  };
}

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
  } & TestCountCarrier & BatchNameCarrier): PracticeTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      ...(t.batch?.displayName !== undefined ? { batchName: t.batch.displayName } : {}),
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
  } & TestCountCarrier & BatchNameCarrier): ExamTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      ...(t.batch?.displayName !== undefined ? { batchName: t.batch.displayName } : {}),
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
    correctTextAnswer?: string | null;
    explanation?: string | null;
    correctOptionIdsAnswers?: string[] | null;
    options?: Array<{ id: string; text: string; mediaUrl?: string | null }>;
  }): TestQuestionResponse {
    return {
      id: q.id,
      type: q.type,
      questionText: q.text,
      mediaUrl: q.mediaUrl ?? null,
      correctTextAnswer: q.correctTextAnswer ?? null,
      explanation: q.explanation ?? null,
      correctOptionIdsAnswers: q.correctOptionIdsAnswers ?? [],
      options: (q.options ?? []).map((o) => ({
        id: o.id,
        text: o.text,
        mediaUrl: o.mediaUrl ?? null,
      })),
    };
  },

  /** Question shape for active attempt — strips correct answer fields so students can't see them. */
  questionForAttempt(q: {
    id: string;
    type: number;
    text: string;
    mediaUrl?: string | null;
    options?: Array<{ id: string; text: string; mediaUrl?: string | null }>;
  }): Omit<TestQuestionResponse, 'correctTextAnswer' | 'explanation'> {
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
    } & TestCountCarrier & BatchNameCarrier,
    stats?: { attemptCount?: number; bestScore?: number | null; lastAttemptAt?: Date | null; canAttempt?: boolean },
  ): PracticeAvailableTestResponse {
    const totalQuestions = resolveTotalQuestions(t);
    const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
    const base: PracticeAvailableTestResponse = {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      ...(t.batch?.displayName !== undefined ? { batchName: t.batch.displayName } : {}),
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
    } & TestCountCarrier & BatchNameCarrier,
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
      ...(t.batch?.displayName !== undefined ? { batchName: t.batch.displayName } : {}),
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

  /**
   * Student attempt detail: one entry per question in attempt order, with nested student vs correct payloads.
   * Correct answer is omitted until policy allows (practice after submit; exam per result visibility).
   */
  attemptQuestionForStudent(params: {
    question: QuestionForStudentAttemptRow;
    answerRow: TestAttemptAnswer | undefined;
    includeCorrectAnswer: boolean;
    includeStudentScoring: boolean;
    /** When true (e.g. exam submitted before results release), omit student answer entirely. */
    hideStudentAnswer: boolean;
  }): StudentAttemptQuestionResponse {
    const { question, answerRow, includeCorrectAnswer, includeStudentScoring, hideStudentAnswer } = params;
    const questionResponse = TestMapper.question(question);
    if (hideStudentAnswer) {
      return {
        question: questionResponse,
        studentAnswer: null,
        correctAnswer: null,
      };
    }
    const studentAnswer = mapStudentAnswerPayload(answerRow, includeStudentScoring);
    const correctAnswer: StudentAttemptCorrectPayload | null = includeCorrectAnswer
      ? {
          correctOptionIds: question.correctOptionIdsAnswers ?? [],
          correctTextAnswer: question.correctTextAnswer ?? null,
        }
      : null;
    return {
      question: questionResponse,
      studentAnswer,
      correctAnswer,
    };
  },
};

