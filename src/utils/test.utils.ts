/**
 * test.utils.ts
 * Combined utility module for the test/LMS module.
 * Covers: question validation, access guards, scoring, attempt result mapping, analytics summary.
 */

import { TestOption, TestQuestion, TestAttemptAnswer, UserRole } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
import { QuestionType } from '../constants/test-enums';
import * as batchRepo from '../repositories/batch.repo';
import logger from './logger';

// ---------------------------------------------------------------------------
// Question Validation
// ---------------------------------------------------------------------------

export function validateQuestionPayload(payload: {
  type: number;
  correctTextAnswer?: string | null;
  correctOptionIdsAnswers?: Array<string | number>;
  options?: Array<{ text: string; mediaUrl?: string | null }>;
}): void {
  const isMcqType = payload.type === QuestionType.SINGLE_CHOICE || payload.type === QuestionType.MULTIPLE_CHOICE;
  const isTextAnswerType = ([QuestionType.TRUE_FALSE, QuestionType.NUMERICAL, QuestionType.FILL_IN_THE_BLANK] as number[]).includes(payload.type);

  if (isMcqType) {
    if (!payload.options?.length || payload.options.length < 4) {
      throw new BadRequestError('MCQ questions require at least 4 options');
    }
    if (payload.options.length > 10) {
      throw new BadRequestError('MCQ questions allow at most 10 options');
    }
    if (!payload.correctOptionIdsAnswers?.length) {
      throw new BadRequestError('correctOptionIdsAnswers is required for MCQ question types');
    }
  }
  if (isTextAnswerType) {
    if (!payload.correctTextAnswer?.trim()) {
      throw new BadRequestError('correctTextAnswer is required for this question type');
    }
  }
}

// ---------------------------------------------------------------------------
// Access Guards
// ---------------------------------------------------------------------------


type AccessUser = {
  id: number;
  role: UserRole;
};

type AssertTestBatchAccessParams = {
  user: AccessUser;
  batchId: number;
  businessId: number;
  entityLabel: string;
  entityId: string;
};

export async function assertTestBatchAccess(params: AssertTestBatchAccessParams): Promise<void> {
  const { user, batchId, businessId, entityLabel, entityId } = params;

  logger.info(
    `[test-access] assertTestBatchAccess businessId=${businessId} userId=${user.id} role=${user.role} batchId=${batchId} entityLabel=${entityLabel} entityId=${entityId}`,
  );

  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
    return;
  }

  if (user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) {
    const isActiveUserInBatch = await batchRepo.isActiveUserInBatch(user.id, batchId);
    if (!isActiveUserInBatch) {
      logger.warn(
        `[test-access] assertTestBatchAccess not-found businessId=${businessId} userId=${user.id} role=${user.role} batchId=${batchId} entityLabel=${entityLabel} entityId=${entityId}`,
      );
      throw new NotFoundError(`${entityLabel} not found`);
    }
    return;
  }

  logger.warn(
    `[test-access] assertTestBatchAccess forbidden role businessId=${businessId} userId=${user.id} role=${user.role} entityLabel=${entityLabel} entityId=${entityId}`,
  );
  throw new ForbiddenError('Access denied');
}

/** Teacher/student must be an active member of every listed batch (for create/update batch assignments). */
export async function assertTestBatchAccessForAllBatches(params: {
  user: AccessUser;
  batchIds: number[];
  businessId: number;
  entityLabel: string;
  entityId: string;
}): Promise<void> {
  const { user, batchIds, businessId, entityLabel, entityId } = params;
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
    return;
  }
  if (!batchIds.length) {
    logger.warn(`[test-access] assertTestBatchAccessForAllBatches empty batchIds entityLabel=${entityLabel} entityId=${entityId}`);
    throw new BadRequestError('At least one batch is required');
  }
  if (user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) {
    for (const batchId of batchIds) {
      await assertTestBatchAccess({ user, batchId, businessId, entityLabel, entityId });
    }
    return;
  }
  logger.warn(
    `[test-access] assertTestBatchAccessForAllBatches forbidden role businessId=${businessId} userId=${user.id} role=${user.role}`,
  );
  throw new ForbiddenError('Access denied');
}

/** Teacher or student must be in at least one of the test’s batches; admin/superadmin unrestricted. */
export async function assertTestBatchOverlapForTeacherOrAdmin(params: {
  user: AccessUser;
  testBatchIds: number[];
  businessId: number;
  entityLabel: string;
  entityId: string;
}): Promise<void> {
  const { user, testBatchIds, businessId, entityLabel, entityId } = params;
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
    return;
  }
  if (user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) {
    if (!testBatchIds.length) {
      logger.warn(`[test-access] assertTestBatchOverlapForTeacherOrAdmin empty testBatchIds entityId=${entityId}`);
      throw new NotFoundError(`${entityLabel} not found`);
    }
    const activeBatchIds = await batchRepo.findActiveBatchIdsForUser(user.id);
    const activeSet = new Set(activeBatchIds);
    const overlap = testBatchIds.some((id) => activeSet.has(id));
    if (!overlap) {
      logger.warn(
        `[test-access] assertTestBatchOverlapForTeacherOrAdmin no overlap userId=${user.id} entityLabel=${entityLabel} entityId=${entityId}`,
      );
      throw new NotFoundError(`${entityLabel} not found`);
    }
    return;
  }
  logger.warn(
    `[test-access] assertTestBatchOverlapForTeacherOrAdmin forbidden role userId=${user.id} role=${user.role} entityLabel=${entityLabel}`,
  );
  throw new ForbiddenError('Access denied');
}


export async function assertTeacherInBatch(userId: number, batchId: number): Promise<void> {
  const isTeacherActiveMember = await batchRepo.isActiveUserInBatch(userId, batchId);
  if (!isTeacherActiveMember) {
    logger.warn(`[test-access] assertTeacherInBatch forbidden userId=${userId} batchId=${batchId}`);
    throw new ForbiddenError('Access denied to this batch');
  }
}

export async function assertBatchBelongsToBusiness(businessId: number, batchId: number): Promise<void> {
  const batchOwnerBusinessId = await batchRepo.findBatchBusinessId(batchId);
  if (!batchOwnerBusinessId) throw new BadRequestError('Batch not found');
  if (batchOwnerBusinessId !== businessId) throw new BadRequestError('Batch does not belong to this business');
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type SubmitAnswerPayload = {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
};

export type QuestionOptionRecord = Pick<TestOption, 'id' | 'text' | 'mediaUrl'>;

export type ScoringQuestionRecord = Pick<
  TestQuestion,
  'id' | 'type' | 'text' | 'correctTextAnswer' | 'correctOptionIdsAnswers' | 'mediaUrl'
> & {
  options: QuestionOptionRecord[];
};

/** Strips whitespace and lowercases a string for case-insensitive comparison. */
export function normalizeText(rawText: string): string {
  return rawText.trim().toLowerCase();
}

/** Parses a string to a finite number, returns null if not a valid number. */
export function normalizeNumeric(rawValue: string): number | null {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateQuestion(params: {
  question: ScoringQuestionRecord;
  provided: SubmitAnswerPayload | undefined;
  isExam: boolean;
  defaultMarksPerQuestion: number;
  negativeMarksPerQuestion: number;
}): { isCorrect: boolean | null; obtainedMarks: number | null; selectedOptionIds: string[]; textAnswer: string | null } {
  const { question, provided, isExam, defaultMarksPerQuestion, negativeMarksPerQuestion } = params;

  const selectedOptionIds = (provided?.selectedOptionIds ?? []).filter(Boolean);
  const textAnswer = provided?.textAnswer !== undefined ? String(provided.textAnswer) : null;

  const studentAnswered = selectedOptionIds.length > 0 || (textAnswer !== null && textAnswer.trim().length > 0);

  if (!studentAnswered) {
    return {
      isCorrect: null,
      obtainedMarks: 0,
      selectedOptionIds: [],
      textAnswer: textAnswer?.trim().length ? textAnswer : null,
    };
  }

  const questionType = question.type;
  const isMcqType = questionType === QuestionType.SINGLE_CHOICE || questionType === QuestionType.MULTIPLE_CHOICE;
  const isTextAnswerType = questionType === QuestionType.TRUE_FALSE
    || questionType === QuestionType.NUMERICAL
    || questionType === QuestionType.FILL_IN_THE_BLANK;

  let isAnswerCorrect = false;

  if (isMcqType) {
    // Only consider option IDs that still exist on the question (guards against stale IDs)
    const currentOptionIds = new Set(question.options.map((option) => option.id));
    const validCorrectOptionIds: string[] = (question.correctOptionIdsAnswers ?? [])
      .filter(Boolean)
      .filter((optionId) => currentOptionIds.has(optionId));

    const studentSelectedSet = new Set(selectedOptionIds);
    const correctOptionSet = new Set(validCorrectOptionIds);

    if (studentSelectedSet.size === correctOptionSet.size) {
      isAnswerCorrect = true;
      for (const selectedId of studentSelectedSet) {
        if (!correctOptionSet.has(selectedId)) {
          isAnswerCorrect = false;
          break;
        }
      }
    }
  } else if (isTextAnswerType) {
    if (questionType === QuestionType.NUMERICAL) {
      const expectedRawValue = question.correctTextAnswer;
      if (expectedRawValue === null || expectedRawValue === '') {
        // No correct answer configured — cannot score
        return { isCorrect: null, obtainedMarks: 0, selectedOptionIds: [], textAnswer };
      }
      const expectedNumber = normalizeNumeric(expectedRawValue);
      const studentNumber = normalizeNumeric(textAnswer ?? '');
      isAnswerCorrect = expectedNumber !== null && studentNumber !== null && expectedNumber === studentNumber;
    } else {
      // TRUE_FALSE and FILL_IN_THE_BLANK — case-insensitive text match
      const expectedText = normalizeText(question.correctTextAnswer ?? '');
      const studentText = normalizeText(textAnswer ?? '');
      isAnswerCorrect = expectedText.length > 0 && expectedText === studentText;
    }
  }

  if (isAnswerCorrect) {
    return { isCorrect: true, obtainedMarks: defaultMarksPerQuestion, selectedOptionIds, textAnswer };
  }

  const marksDeducted = isExam ? -negativeMarksPerQuestion : 0;
  return { isCorrect: false, obtainedMarks: marksDeducted, selectedOptionIds, textAnswer };
}

// ---------------------------------------------------------------------------
// Attempt Result Mapping
// ---------------------------------------------------------------------------

type AnswerByQuestion = Pick<TestAttemptAnswer, 'questionId' | 'isCorrect' | 'obtainedMarks'>;

/** Builds a questionId → answer row map for O(1) lookup during result rendering. */
export function buildAnswersByQuestionIdMap(answers: TestAttemptAnswer[] | undefined | null): Map<string, TestAttemptAnswer> {
  const answerMap = new Map<string, TestAttemptAnswer>();
  for (const answer of answers ?? []) answerMap.set(answer.questionId, answer);
  return answerMap;
}

/** Builds a questionId → evaluated result map for O(1) lookup during submit response. */
export function buildEvaluatedByQuestionIdMap(
  evaluatedAnswers: Array<{ questionId: string; isCorrect: boolean | null; obtainedMarks: number | null }>,
): Map<string, { questionId: string; isCorrect: boolean | null; obtainedMarks: number | null }> {
  const evaluatedMap = new Map<string, { questionId: string; isCorrect: boolean | null; obtainedMarks: number | null }>();
  for (const evaluatedAnswer of evaluatedAnswers) evaluatedMap.set(evaluatedAnswer.questionId, evaluatedAnswer);
  return evaluatedMap;
}

/** Maps a question + its evaluated result into the submit response shape. */
export function mapSubmittedResultQuestion(
  question: { id: string; correctOptionIdsAnswers: string[] | null; correctTextAnswer: string | null; explanation?: string | null },
  evaluatedByQuestionId: Map<string, { isCorrect: boolean | null; obtainedMarks: number | null }>,
  showExplanations: boolean,
) {
  const evaluatedResult = evaluatedByQuestionId.get(question.id);
  return {
    questionId: question.id,
    isCorrect: evaluatedResult?.isCorrect ?? null,
    obtainedMarks: evaluatedResult?.obtainedMarks ?? null,
    correctOptionIds: question.correctOptionIdsAnswers ?? [],
    correctTextAnswer: question.correctTextAnswer ?? null,
    explanation: showExplanations ? (question.explanation ?? null) : null,
  };
}

/** Maps a question + its stored answer into the attempt detail response shape. */
export function mapDetailResultQuestion(
  question: { id: string; correctOptionIdsAnswers: string[] | null; correctTextAnswer: string | null },
  answersByQuestionId: Map<string, AnswerByQuestion>,
) {
  const storedAnswer = answersByQuestionId.get(question.id);
  return {
    questionId: question.id,
    isCorrect: storedAnswer?.isCorrect ?? null,
    obtainedMarks: storedAnswer?.obtainedMarks ?? null,
    correctOptionIds: question.correctOptionIdsAnswers ?? [],
    correctTextAnswer: question.correctTextAnswer ?? null,
  };
}

// ---------------------------------------------------------------------------
// Analytics Summary
// ---------------------------------------------------------------------------

export type AnalyticsAttemptLike = {
  score: number | null;
  percentage: number | null;
};

export type AttemptSummaryStats = {
  totalAttempts: number;
  averageScore: number;
  averagePercentage: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
};

/** Computes aggregate stats (average, pass rate, high/low) across a set of attempts. */
export function computeAttemptSummaryStats(
  attempts: AnalyticsAttemptLike[],
  opts: { passThresholdPercent: number },
): AttemptSummaryStats {
  const totalAttempts = attempts.length;
  const allScores = attempts.map((attempt) => attempt.score ?? 0);
  const allPercentages = attempts.map((attempt) => attempt.percentage ?? 0);

  const averageScore = totalAttempts ? allScores.reduce((sum, score) => sum + score, 0) / totalAttempts : 0;
  const averagePercentage = totalAttempts ? allPercentages.reduce((sum, pct) => sum + pct, 0) / totalAttempts : 0;
  const highestScore = totalAttempts ? Math.max(...allScores) : 0;
  const lowestScore = totalAttempts ? Math.min(...allScores) : 0;
  const passCount = attempts.filter((attempt) => (attempt.percentage ?? 0) >= opts.passThresholdPercent).length;
  const passRate = totalAttempts ? (passCount / totalAttempts) * 100 : 0;

  return { totalAttempts, averageScore, averagePercentage, passRate, highestScore, lowestScore, passCount };
}
