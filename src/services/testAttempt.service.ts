import { UserRole, ExamTest, PracticeTest, TestAttempt, TestAttemptAnswer } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
import { AttemptStatus, LockedReason, ResultVisibilityExam, TestStatus } from '../constants/test-enums';
import logger from '../utils/logger';
import * as attemptRepo from '../repositories/testAttempt.repo';
import * as practiceRepo from '../repositories/practiceTest.repo';
import * as examRepo from '../repositories/examTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import * as batchUserRepo from '../repositories/batch.repo';
import { computeAttemptSummaryStats } from '../utils/test.utils';
import { buildAnswersByQuestionIdMap, buildEvaluatedByQuestionIdMap, mapSubmittedResultQuestion } from '../utils/test.utils';
import { evaluateQuestion, type ScoringQuestionRecord as QuestionRecord, type SubmitAnswerPayload } from '../utils/test.utils';
import { TestMapper } from '../mappers/test.mapper';

type AttemptRecord = Pick<
  TestAttempt,
  'id' | 'practiceTestId' | 'examTestId' | 'userId' | 'status' | 'startedAt' | 'submittedAt' | 'score' | 'totalScore' | 'percentage'
>;

function hashStringToUint32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function createSeededRng(seed: string): () => number {
  // Mulberry32
  let a = hashStringToUint32(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArrayInPlace<T>(items: T[], rand: () => number) {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rand() * (index + 1));
    const temp = items[index] as T;
    items[index] = items[swapIndex] as T;
    items[swapIndex] = temp;
  }
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Wrap values containing special chars in quotes and escape embedded quotes.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}



function buildAttemptSummary(attemptRecord: AttemptRecord) {
  return {
    id: attemptRecord.id,
    practiceTestId: attemptRecord.practiceTestId ?? null,
    examTestId: attemptRecord.examTestId ?? null,
    userId: attemptRecord.userId,
    status: attemptRecord.status,
    startedAt: attemptRecord.startedAt,
    submittedAt: attemptRecord.submittedAt ?? null,
    score: attemptRecord.score ?? null,
    totalScore: attemptRecord.totalScore ?? null,
    percentage: attemptRecord.percentage ?? null,
  };
}

function mapAttemptAnswer(answerRow: TestAttemptAnswer) {
  return {
    questionId: answerRow.questionId,
    selectedOptionIds: answerRow.selectedOptionIds ?? [],
    textAnswer: answerRow.textAnswer ?? null,
    isCorrect: answerRow.isCorrect ?? null,
    obtainedMarks: answerRow.obtainedMarks ?? null,
  };
}

function hasExamStartReached(now: Date, startAt: Date): boolean {
  const nowMs = now.getTime();
  const startAtMs = startAt.getTime();
  if (nowMs + 1000 >= startAtMs) return true;
  const tzOffsetMs = Math.abs(now.getTimezoneOffset()) * 60_000;
  return nowMs + 1000 >= startAtMs - tzOffsetMs;
}

export class TestAttemptService {
  private assertTeacherOrAdmin(user: { id: number; role: UserRole }) {
    const ok = user.role === UserRole.ADMIN || user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN;
    if (!ok) throw new ForbiddenError('Forbidden');
  }

  private async assertStudentInBatch(userId: number, batchId: number): Promise<void> {
    const ok = await batchUserRepo.isActiveUserInBatch(userId, batchId);
    if (!ok) {
      logger.warn(`[test-attempt] student not in batch userId=${userId} batchId=${batchId}`);
      throw new ForbiddenError('Student is not an active member of this batch');
    }
  }

  async startPracticeAttempt(businessId: number, user: { id: number; role: UserRole }, practiceTestId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can start attempts');
    logger.info(`[test-attempt] startPracticeAttempt businessId=${businessId} userId=${user.id} practiceTestId=${practiceTestId}`);

    const practiceTest = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!practiceTest) {
      logger.warn(`[test-attempt] practice test not found businessId=${businessId} practiceTestId=${practiceTestId}`);
      throw new NotFoundError('Practice test not found');
    }
    if (practiceTest.status !== TestStatus.PUBLISHED) {
      logger.warn(`[test-attempt] practice test not published practiceTestId=${practiceTestId} status=${practiceTest.status}`);
      throw new BadRequestError('Practice test is not published');
    }

    await this.assertStudentInBatch(user.id, practiceTest.batchId);

    const inProgressAttempts = await attemptRepo.findPracticeAttemptsByUser(practiceTestId, user.id, {
      where: { status: AttemptStatus.IN_PROGRESS },
      take: 1,
    });
    if (inProgressAttempts.length) {
      const inProgressAttempt = inProgressAttempts[0];
      if (!inProgressAttempt) {
        logger.warn(`[test-attempt] practice attempt resume failed: missing attempt record practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Practice attempt not found');
      }
      const questionRecords = (await questionRepo.listPracticeTestQuestions(businessId, practiceTestId)) as QuestionRecord[];
      if (!questionRecords.length) {
        logger.warn(`[test-attempt] practice attempt resume blocked: no questions practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Practice test has no questions');
      }
      const randomizer = createSeededRng(`practice:${inProgressAttempt.id}`);
      const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
      if (practiceTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
      if (practiceTest.shuffleOptions) {
        orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
      }

      logger.info(`[test-attempt] practice attempt resumed attemptId=${inProgressAttempt.id} questions=${orderedQuestions.length}`);
      return {
        attemptId: inProgressAttempt.id,
        startedAt: inProgressAttempt.startedAt,
        test: practiceTest,
        questions: orderedQuestions,
      };
    }

    const newAttempt = await attemptRepo.createTestAttempt({
      practiceTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    const questionRecords = (await questionRepo.listPracticeTestQuestions(businessId, practiceTestId)) as QuestionRecord[];
    if (!questionRecords.length) {
      logger.warn(`[test-attempt] practice attempt blocked: no questions practiceTestId=${practiceTestId}`);
      throw new BadRequestError('Practice test has no questions');
    }
    const randomizer = createSeededRng(`practice:${newAttempt.id}`);
    const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
    if (practiceTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
    if (practiceTest.shuffleOptions) {
      orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
    }

    logger.info(`[test-attempt] practice attempt started attemptId=${newAttempt.id} questions=${orderedQuestions.length}`);
    return {
      attemptId: newAttempt.id,
      startedAt: newAttempt.startedAt,
      test: practiceTest,
      questions: orderedQuestions,
    };
  }

  async startExamAttempt(businessId: number, user: { id: number; role: UserRole }, examTestId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can start attempts');
    logger.info(`[test-attempt] startExamAttempt businessId=${businessId} userId=${user.id} examTestId=${examTestId}`);

    const examTest = await examRepo.findExamTestById(businessId, examTestId);
    if (!examTest) {
      logger.warn(`[test-attempt] exam test not found businessId=${businessId} examTestId=${examTestId}`);
      throw new NotFoundError('Exam test not found');
    }
    if (examTest.status !== TestStatus.PUBLISHED) {
      logger.warn(`[test-attempt] exam test not published examTestId=${examTestId} status=${examTest.status}`);
      throw new BadRequestError('Exam test is not published');
    }

    await this.assertStudentInBatch(user.id, examTest.batchId);

    const now = new Date();
    const nowMs = now.getTime();
    const deadlineAtMs = examTest.deadlineAt.getTime();
    logger.info(`[test-attempt] exam timing now=${now.toISOString()} startAt=${examTest.startAt.toISOString()} deadlineAt=${examTest.deadlineAt.toISOString()}`);
    // 1s tolerance to avoid clock drift/jitter
    if (!hasExamStartReached(now, examTest.startAt)) {
      logger.warn(`[test-attempt] exam not started examTestId=${examTestId} now=${now.toISOString()} startAt=${examTest.startAt.toISOString()}`);
      throw new BadRequestError('Exam has not started yet');
    }
    if (nowMs > deadlineAtMs) {
      logger.warn(`[test-attempt] exam deadline passed examTestId=${examTestId} now=${now.toISOString()} deadlineAt=${examTest.deadlineAt.toISOString()}`);
      throw new BadRequestError('Exam deadline has passed');
    }

    const completedAttempts = await attemptRepo.findExamAttemptsByUser(examTestId, user.id, {
      where: { status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] } },
      take: 1,
    });
    if (completedAttempts.length) {
      logger.warn(`[test-attempt] exam already attempted examTestId=${examTestId} userId=${user.id}`);
      throw new BadRequestError('You have already attempted this exam');
    }

    const inProgressAttempts = await attemptRepo.findExamAttemptsByUser(examTestId, user.id, {
      where: { status: AttemptStatus.IN_PROGRESS },
      take: 1,
    });
    if (inProgressAttempts.length) {
      const inProgressAttempt = inProgressAttempts[0];
      if (!inProgressAttempt) {
        logger.warn(`[test-attempt] exam attempt resume failed: missing attempt record examTestId=${examTestId}`);
        throw new BadRequestError('Exam attempt not found');
      }
      const questionRecords = (await questionRepo.listExamTestQuestions(businessId, examTestId)) as QuestionRecord[];
      if (!questionRecords.length) {
        logger.warn(`[test-attempt] exam attempt resume blocked: no questions examTestId=${examTestId}`);
        throw new BadRequestError('Exam test has no questions');
      }
      const randomizer = createSeededRng(`exam:${inProgressAttempt.id}`);
      const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
      if (examTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
      if (examTest.shuffleOptions) {
        orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
      }

      logger.info(`[test-attempt] exam attempt resumed attemptId=${inProgressAttempt.id} questions=${orderedQuestions.length}`);
      return {
        attemptId: inProgressAttempt.id,
        startedAt: inProgressAttempt.startedAt,
        test: examTest,
        questions: orderedQuestions,
      };
    }

    const newAttempt = await attemptRepo.createTestAttempt({
      examTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
    });

    const questionRecords = (await questionRepo.listExamTestQuestions(businessId, examTestId)) as QuestionRecord[];
    if (!questionRecords.length) {
      logger.warn(`[test-attempt] exam attempt blocked: no questions examTestId=${examTestId}`);
      throw new BadRequestError('Exam test has no questions');
    }
    const randomizer = createSeededRng(`exam:${newAttempt.id}`);
    const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
    if (examTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
    if (examTest.shuffleOptions) {
      orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
    }

    logger.info(
      `[test-attempt] exam attempt started attemptId=${newAttempt.id} questions=${orderedQuestions.length} effectiveWindow=${examTest.startAt.toISOString()}..${examTest.deadlineAt.toISOString()}`,
    );
    return {
      attemptId: newAttempt.id,
      startedAt: newAttempt.startedAt,
      test: examTest,
      questions: orderedQuestions,
    };
  }

  private computeExamEffectiveEnd(examTest: ExamTest, attemptRecord: TestAttempt): Date {
    const startedAt = new Date(attemptRecord.startedAt);
    const durationMs = Number(examTest.durationMinutes) * 60_000;
    const endByDuration = new Date(startedAt.getTime() + durationMs);
    return endByDuration < examTest.deadlineAt ? endByDuration : examTest.deadlineAt;
  }

  private shouldRevealExamResults(examTest: ExamTest, now: Date): boolean {
    if (examTest.resultVisibility === ResultVisibilityExam.HIDDEN) return false;
    // AFTER_DEADLINE
    return now >= examTest.deadlineAt;
  }

  async getPracticeAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');
    logger.info(`[test-attempt] getPracticeAttemptDetails businessId=${businessId} userId=${user.id} attemptId=${attemptId}`);

    const attemptRecord = await attemptRepo.findTestAttemptWithInclude(attemptId, {
      practiceTest: {
        include: {
          batch: { select: { id: true, displayName: true } },
        },
      },
      answers: true,
    });
    if (!attemptRecord?.practiceTestId || !attemptRecord.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attemptRecord.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attemptRecord.userId !== user.id) throw new BadRequestError('Forbidden');

    await this.assertStudentInBatch(user.id, attemptRecord.practiceTest.batchId);

    const questionRecords = (await questionRepo.listPracticeTestQuestions(businessId, attemptRecord.practiceTestId)) as QuestionRecord[];
    const randomizer = createSeededRng(`practice:${attemptRecord.id}`);
    const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
    if (attemptRecord.practiceTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
    if (attemptRecord.practiceTest.shuffleOptions) {
      orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
    }

    const answersByQuestionId = buildAnswersByQuestionIdMap(attemptRecord.answers);
    const isSubmittedAttempt =
      attemptRecord.status === AttemptStatus.SUBMITTED || attemptRecord.status === AttemptStatus.AUTO_SUBMITTED;
    const questionsWithAnswers = orderedQuestions.map((questionRecord) =>
      TestMapper.attemptQuestionForStudent({
        question: questionRecord,
        answerRow: answersByQuestionId.get(questionRecord.id),
        includeCorrectAnswer: isSubmittedAttempt,
        includeStudentScoring: isSubmittedAttempt,
        hideStudentAnswer: false,
      }),
    );

    return {
      attempt: buildAttemptSummary(attemptRecord),
      test: attemptRecord.practiceTest,
      questions: questionsWithAnswers,
    };
  }

  async getExamAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');
    logger.info(`[test-attempt] getExamAttemptDetails businessId=${businessId} userId=${user.id} attemptId=${attemptId}`);

    const attemptRecord = await attemptRepo.findTestAttemptWithInclude(attemptId, {
      examTest: {
        include: {
          batch: { select: { id: true, displayName: true } },
        },
      },
      answers: true,
    });
    if (!attemptRecord?.examTestId || !attemptRecord.examTest) throw new NotFoundError('Exam attempt not found');
    if (attemptRecord.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attemptRecord.userId !== user.id) throw new BadRequestError('Forbidden');

    await this.assertStudentInBatch(user.id, attemptRecord.examTest.batchId);

    const questionRecords = (await questionRepo.listExamTestQuestions(businessId, attemptRecord.examTestId)) as QuestionRecord[];
    const randomizer = createSeededRng(`exam:${attemptRecord.id}`);
    const orderedQuestions = questionRecords.map((questionRecord) => ({ ...questionRecord, options: [...questionRecord.options] }));
    if (attemptRecord.examTest.shuffleQuestions) shuffleArrayInPlace(orderedQuestions, randomizer);
    if (attemptRecord.examTest.shuffleOptions) {
      orderedQuestions.forEach((questionRecord) => shuffleArrayInPlace(questionRecord.options, randomizer));
    }

    const now = new Date();
    const shouldRevealResults = this.shouldRevealExamResults(attemptRecord.examTest, now);

    const maskedAttempt: AttemptRecord = shouldRevealResults
      ? attemptRecord
      : { ...attemptRecord, score: null, totalScore: null, percentage: null };

    const answersByQuestionId = buildAnswersByQuestionIdMap(attemptRecord.answers);
    const isSubmittedAttempt =
      attemptRecord.status === AttemptStatus.SUBMITTED || attemptRecord.status === AttemptStatus.AUTO_SUBMITTED;
    const hideStudentAnswer = !shouldRevealResults && isSubmittedAttempt;

    const questionsWithAnswers = orderedQuestions.map((questionRecord) =>
      TestMapper.attemptQuestionForStudent({
        question: questionRecord,
        answerRow: answersByQuestionId.get(questionRecord.id),
        includeCorrectAnswer: shouldRevealResults && isSubmittedAttempt,
        includeStudentScoring: shouldRevealResults && isSubmittedAttempt,
        hideStudentAnswer,
      }),
    );

    // Compute timeRemainingSeconds for in-progress attempts
    let timeRemainingSeconds: number | null = null;
    if (attemptRecord.status === AttemptStatus.IN_PROGRESS) {
      const effectiveEnd = this.computeExamEffectiveEnd(attemptRecord.examTest, attemptRecord);
      timeRemainingSeconds = Math.max(0, Math.floor((effectiveEnd.getTime() - now.getTime()) / 1000));
    }

    return {
      attempt: { ...buildAttemptSummary(maskedAttempt), ...(timeRemainingSeconds !== null ? { timeRemainingSeconds } : {}) },
      test: attemptRecord.examTest,
      questions: questionsWithAnswers,
    };
  }

  async submitPracticeAttempt(
    businessId: number,
    user: { id: number; role: UserRole },
    attemptId: string,
    answers: SubmitAnswerPayload[],
  ) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can submit attempts');
    logger.info(`[test-attempt] submitPracticeAttempt businessId=${businessId} userId=${user.id} attemptId=${attemptId} answers=${answers?.length ?? 0}`);

    const attemptRecord = await attemptRepo.findTestAttemptWithInclude(attemptId, {
      practiceTest: true,
    });
    if (!attemptRecord?.practiceTestId || !attemptRecord.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attemptRecord.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attemptRecord.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attemptRecord.status !== AttemptStatus.IN_PROGRESS) {
      logger.info(`[test-attempt] practice attempt already submitted attemptId=${attemptId} status=${attemptRecord.status}`);
      const existingAttempt = await attemptRepo.findTestAttemptWithInclude(attemptId, { answers: true });
      const submittedAt = attemptRecord.submittedAt ?? existingAttempt?.submittedAt ?? new Date();
      return {
        attemptId,
        status: attemptRecord.status,
        score: attemptRecord.score ?? 0,
        totalScore: attemptRecord.totalScore ?? 0,
        percentage: attemptRecord.percentage ?? 0,
        answers: existingAttempt?.answers?.map(mapAttemptAnswer) ?? [],
        submittedAt,
      };
    }

    await this.assertStudentInBatch(user.id, attemptRecord.practiceTest.batchId);

    const questionRecords = (await questionRepo.listPracticeTestQuestions(businessId, attemptRecord.practiceTestId)) as QuestionRecord[];
    const questionIdSet = new Set(questionRecords.map((q) => q.id));
    const submittedAnswers = answers ?? [];
    const invalidAnswerPayload = submittedAnswers.find((a) => !questionIdSet.has(a.questionId));
    if (invalidAnswerPayload) {
      throw new BadRequestError(`Invalid questionId in answers: ${invalidAnswerPayload.questionId}`);
    }

    const answersByQuestionId = new Map<string, SubmitAnswerPayload>(submittedAnswers.map((a) => [a.questionId, a]));

    const rawDefaultMarksValue = Number(attemptRecord.practiceTest.defaultMarksPerQuestion);
    const defaultMarksPerQuestion = Number.isFinite(rawDefaultMarksValue) ? rawDefaultMarksValue : 1;
    const totalScore = defaultMarksPerQuestion * questionRecords.length;

    const evaluatedAnswers = questionRecords.map((q) => {
      const evaluation = evaluateQuestion({
        question: q,
        provided: answersByQuestionId.get(q.id),
        isExam: false,
        defaultMarksPerQuestion,
        negativeMarksPerQuestion: 0,
      });
      return { questionId: q.id, ...evaluation };
    });

    const score = evaluatedAnswers.reduce((sum, e) => sum + (e.obtainedMarks ?? 0), 0);
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    const submittedAt = new Date();

    const finalizedAttempt = await attemptRepo.upsertAttemptAnswersAndFinalize({
      attemptId,
      evaluated: evaluatedAnswers,
      attemptUpdate: {
        status: AttemptStatus.SUBMITTED,
        submittedAt,
        score,
        totalScore,
        percentage,
      },
    });

    logger.info(`[test-attempt] practice attempt evaluated attemptId=${attemptId} score=${score} totalScore=${totalScore} percentage=${percentage}`);
    const submitted = finalizedAttempt?.submittedAt ?? submittedAt;
    const evaluatedByQuestionId = buildEvaluatedByQuestionIdMap(evaluatedAnswers);
    return {
      attemptId,
      status: finalizedAttempt?.status ?? AttemptStatus.SUBMITTED,
      score,
      totalScore,
      percentage,
      answers: finalizedAttempt?.answers?.map(mapAttemptAnswer) ?? [],
      submittedAt: submitted,
      result: {
        questions: questionRecords.map((q) => mapSubmittedResultQuestion(q, evaluatedByQuestionId)),
      },
    };
  }

  async submitExamAttempt(
    businessId: number,
    user: { id: number; role: UserRole },
    attemptId: string,
    answers: SubmitAnswerPayload[],
  ) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can submit attempts');
    logger.info(`[test-attempt] submitExamAttempt businessId=${businessId} userId=${user.id} attemptId=${attemptId} answers=${answers?.length ?? 0}`);

    const attemptRecord = await attemptRepo.findTestAttemptWithInclude(attemptId, {
      examTest: true,
    });
    if (!attemptRecord?.examTestId || !attemptRecord.examTest) throw new NotFoundError('Exam attempt not found');
    if (attemptRecord.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attemptRecord.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attemptRecord.status !== AttemptStatus.IN_PROGRESS) {
      logger.info(`[test-attempt] exam attempt already submitted attemptId=${attemptId} status=${attemptRecord.status}`);
      const existingAttempt = await attemptRepo.findTestAttemptWithInclude(attemptId, { answers: true });
      const submittedAt = attemptRecord.submittedAt ?? existingAttempt?.submittedAt ?? new Date();
      const now = new Date();
      const shouldRevealResults = this.shouldRevealExamResults(attemptRecord.examTest, now);
      if (!shouldRevealResults) {
        return {
          attemptId,
          status: attemptRecord.status,
          submittedAt,
        };
      }
      return {
        attemptId,
        status: attemptRecord.status,
        score: attemptRecord.score ?? 0,
        totalScore: attemptRecord.totalScore ?? 0,
        percentage: attemptRecord.percentage ?? 0,
        answers: existingAttempt?.answers?.map(mapAttemptAnswer) ?? [],
        submittedAt,
      };
    }

    await this.assertStudentInBatch(user.id, attemptRecord.examTest.batchId);

    const now = new Date();
    if (now > attemptRecord.examTest.deadlineAt) {
      logger.warn(
        `[test-attempt] submitExamAttempt rejected: deadline passed attemptId=${attemptId} ` +
        `now=${now.toISOString()} deadlineAt=${attemptRecord.examTest.deadlineAt.toISOString()}`
      );
      throw new BadRequestError('Exam deadline has passed, submission not allowed');
    }

    const questionRecords = (await questionRepo.listExamTestQuestions(businessId, attemptRecord.examTestId)) as QuestionRecord[];
    const questionIdSet = new Set(questionRecords.map((q) => q.id));
    const submittedAnswers = answers ?? [];
    const invalidAnswerPayload = submittedAnswers.find((a) => !questionIdSet.has(a.questionId));
    if (invalidAnswerPayload) {
      throw new BadRequestError(`Invalid questionId in answers: ${invalidAnswerPayload.questionId}`);
    }

    const answersByQuestionId = new Map<string, SubmitAnswerPayload>(submittedAnswers.map((a) => [a.questionId, a]));

    const rawDefaultMarksValue = Number(attemptRecord.examTest.defaultMarksPerQuestion);
    const defaultMarksPerQuestion = Number.isFinite(rawDefaultMarksValue) ? rawDefaultMarksValue : 1;
    const rawNegativeMarksValue = Number(attemptRecord.examTest.negativeMarksPerQuestion);
    const negativeMarksPerQuestion = Number.isFinite(rawNegativeMarksValue) ? rawNegativeMarksValue : 0;
    const totalScore = defaultMarksPerQuestion * questionRecords.length;

    const evaluatedAnswers = questionRecords.map((q) => {
      const evaluation = evaluateQuestion({
        question: q,
        provided: answersByQuestionId.get(q.id),
        isExam: true,
        defaultMarksPerQuestion,
        negativeMarksPerQuestion,
      });
      return { questionId: q.id, ...evaluation };
    });

    const score = evaluatedAnswers.reduce((sum, e) => sum + (e.obtainedMarks ?? 0), 0);
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    const submittedAt = new Date();

    const effectiveEnd = this.computeExamEffectiveEnd(attemptRecord.examTest, attemptRecord);
    const status = submittedAt > effectiveEnd ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED;

    const finalizedAttempt = await attemptRepo.upsertAttemptAnswersAndFinalize({
      attemptId,
      evaluated: evaluatedAnswers,
      attemptUpdate: {
        status,
        submittedAt,
        score,
        totalScore,
        percentage,
      },
    });

    // const now = new Date();
    const shouldRevealResults = this.shouldRevealExamResults(attemptRecord.examTest, now);
    logger.info(
      `[test-attempt] exam attempt evaluated attemptId=${attemptId} status=${status} score=${score} totalScore=${totalScore} percentage=${percentage} reveal=${shouldRevealResults} effectiveEndAt=${effectiveEnd.toISOString()}`,
    );

    const submitted = finalizedAttempt?.submittedAt ?? submittedAt;
    if (!shouldRevealResults) {
      return {
        attemptId,
        status: finalizedAttempt?.status ?? status,
        submittedAt: submitted,
        resultAvailableAt: attemptRecord.examTest.deadlineAt,
      };
    }

    const evaluatedByQuestionId = buildEvaluatedByQuestionIdMap(evaluatedAnswers);
    return {
      attemptId,
      status: finalizedAttempt?.status ?? status,
      score,
      totalScore,
      percentage,
      answers: finalizedAttempt?.answers?.map(mapAttemptAnswer) ?? [],
      submittedAt: submitted,
      result: {
        questions: questionRecords.map((q) => mapSubmittedResultQuestion(q, evaluatedByQuestionId)),
      },
    };
  }

  async listAvailablePracticeTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailablePracticeTests businessId=${businessId} userId=${user.id}`);
    const availableTests = (await practiceRepo.findPublishedPracticeTestsForStudent(businessId, user.id)) as Array<
      PracticeTest & { _count?: { questions?: number } }
    >;
    logger.info(`[test-attempt] available practice tests count=${availableTests.length} businessId=${businessId} userId=${user.id}`);
    const attemptStatsByTestId = await attemptRepo.getPracticeAttemptStatsByUserForTests(
      availableTests.map((testRecord) => testRecord.id),
      user.id,
    );

    return availableTests.map((testRecord) => {
      const attemptStats =
        attemptStatsByTestId.get(testRecord.id) ?? {
          attemptCount: 0,
          bestScore: null,
          lastAttemptAt: null,
          lastAttemptId: null,
          lastAttemptStatus: null,
          lastAttemptStartedAt: null,
        };
      const totalQuestionCount = testRecord._count?.questions ?? 0;
      const totalMarksAvailable = totalQuestionCount * Number(testRecord.defaultMarksPerQuestion ?? 0);
      const hasPreviousAttempt = attemptStats.attemptCount > 0;
      const isInProgress = attemptStats.lastAttemptStatus === AttemptStatus.IN_PROGRESS;
      const canResume = isInProgress;
      const canStart = !isInProgress;
      const batchInfo = 'batch' in testRecord
        ? (testRecord as { batch?: { displayName: string } | null }).batch
        : undefined;
      return {
        id: testRecord.id,
        businessId,
        batchId: testRecord.batchId,
        ...(batchInfo?.displayName !== undefined ? { batchName: batchInfo.displayName } : {}),
        name: testRecord.name,
        description: testRecord.description ?? null,
        status: testRecord.status,
        isPublished: testRecord.status === TestStatus.PUBLISHED,
        questionCount: totalQuestionCount,
        totalQuestions: totalQuestionCount,
        totalMarks: totalMarksAvailable,
        defaultMarksPerQuestion: testRecord.defaultMarksPerQuestion,
        canAttempt: true,
        canStart,
        canResume,
        attemptId: attemptStats.lastAttemptId ?? null,
        attemptStatus: attemptStats.lastAttemptStatus ?? null,
        ...(hasPreviousAttempt
          ? {
              attemptCount: attemptStats.attemptCount,
              bestScore: attemptStats.bestScore,
              lastAttemptAt: attemptStats.lastAttemptAt,
            }
          : {}),
      };
    });
  }

  async listAvailableExamTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailableExamTests businessId=${businessId} userId=${user.id}`);
    const availableTests = (await examRepo.findPublishedExamTestsForStudent(businessId, user.id)) as Array<
      ExamTest & { _count?: { questions?: number } }
    >;
    logger.info(`[test-attempt] available exam tests count=${availableTests.length} businessId=${businessId} userId=${user.id}`);

    const now = new Date();
    const nowMs = now.getTime();

    const attemptStatsByTestId = await attemptRepo.getExamAttemptStatsByUserForTests(
      availableTests.map((testRecord) => testRecord.id),
      user.id,
    );

    return availableTests.map((testRecord) => {
      const attemptStats =
        attemptStatsByTestId.get(testRecord.id) ?? {
          attemptCount: 0,
          bestScore: null,
          lastAttemptAt: null,
          lastAttemptId: null,
          lastAttemptStatus: null,
          lastAttemptStartedAt: null,
        };
      const attemptsAllowed = 1;
      const attemptsUsed = attemptStats.attemptCount;
      const hasAttempt = attemptsUsed > 0;
      const totalQuestionCount = testRecord._count?.questions ?? 0;
      const totalMarksAvailable = totalQuestionCount * Number(testRecord.defaultMarksPerQuestion ?? 0);

      let canAttempt = true;
      let lockedReason: number | null = null;

      const deadlineAtMs = testRecord.deadlineAt.getTime();

      if (!hasExamStartReached(now, testRecord.startAt)) {
        canAttempt = false;
        lockedReason = LockedReason.NOT_STARTED;
      } else if (nowMs > deadlineAtMs) {
        canAttempt = false;
        lockedReason = LockedReason.DEADLINE_PASSED;
      } else if (attemptsUsed >= attemptsAllowed) {
        canAttempt = false;
        lockedReason = LockedReason.ALREADY_ATTEMPTED;
      }

      // Compute timeRemainingSeconds for in-progress attempts
      let timeRemainingSeconds: number | null = null;
      const isInProgress = attemptStats.lastAttemptStatus === AttemptStatus.IN_PROGRESS;
      if (isInProgress && attemptStats.lastAttemptStartedAt) {
        const durationMs = Number(testRecord.durationMinutes) * 60_000;
        const byDurationMs = attemptStats.lastAttemptStartedAt.getTime() + durationMs;
        const effectiveEndMs = Math.min(byDurationMs, deadlineAtMs);
        timeRemainingSeconds = Math.max(0, Math.floor((effectiveEndMs - nowMs) / 1000));
      }

      const batchInfo = 'batch' in testRecord
        ? (testRecord as { batch?: { displayName: string } | null }).batch
        : undefined;
      return {
        id: testRecord.id,
        businessId,
        batchId: testRecord.batchId,
        ...(batchInfo?.displayName !== undefined ? { batchName: batchInfo.displayName } : {}),
        name: testRecord.name,
        description: testRecord.description ?? null,
        status: testRecord.status,
        isPublished: testRecord.status === TestStatus.PUBLISHED,
        questionCount: totalQuestionCount,
        startAt: testRecord.startAt,
        deadlineAt: testRecord.deadlineAt,
        durationMinutes: testRecord.durationMinutes,
        totalQuestions: totalQuestionCount,
        totalMarks: totalMarksAvailable,
        defaultMarksPerQuestion: testRecord.defaultMarksPerQuestion,
        negativeMarksPerQuestion: testRecord.negativeMarksPerQuestion,
        resultVisibility: testRecord.resultVisibility,
        canAttempt,
        lockedReason,
        attemptsAllowed,
        attemptsUsed,
        hasAttempt,
        attemptId: attemptStats.lastAttemptId ?? null,
        attemptStatus: attemptStats.lastAttemptStatus ?? null,
        lastAttemptAt: attemptStats.lastAttemptAt,
        ...(timeRemainingSeconds !== null ? { timeRemainingSeconds } : {}),
      };
    });
  }

  async getPracticeTestAnalytics(
    businessId: number,
    user: { id: number; role: UserRole },
    practiceTestId: string,
  ) {
    logger.info(
      `[test-attempt] getPracticeTestAnalytics businessId=${businessId} userId=${user.id} role=${user.role} practiceTestId=${practiceTestId}`,
    );

    this.assertTeacherOrAdmin(user);

    const practiceTest = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!practiceTest) throw new NotFoundError('Practice test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, practiceTest.batchId);
      if (!ok) throw new NotFoundError('Practice test not found');
    }

    const finalAttemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attemptRecords = await attemptRepo.getPracticeTestAnalyticsAttempts(practiceTestId, finalAttemptStatuses);

    const questionIdList = await attemptRepo.getPracticeTestQuestionIds(practiceTestId);
    const correctCountRows = await attemptRepo.getPracticeTestCorrectCountsByQuestion(practiceTestId, finalAttemptStatuses);
    const correctCountsByQuestionId = new Map(correctCountRows.map((r) => [r.questionId, r.correctCount]));

    const PASS_THRESHOLD_PERCENT_PRACTICE = 33;
    const summaryStats = computeAttemptSummaryStats(attemptRecords, { passThresholdPercent: PASS_THRESHOLD_PERCENT_PRACTICE });
    const { totalAttempts, averageScore, averagePercentage, passRate, highestScore, lowestScore } = summaryStats;

    const questionStats = questionIdList.map((questionId) => {
      const correctCount = correctCountsByQuestionId.get(questionId) ?? 0;
      const accuracy = totalAttempts ? (correctCount / totalAttempts) * 100 : 0;
      return {
        questionId,
        correctCount,
        totalAttempts,
        accuracy,
      };
    });

    return {
      summary: {
        totalAttempts,
        averageScore,
        averagePercentage,
        passRate,
        highestScore,
        lowestScore,
      },
      attempts: attemptRecords.map((attemptRecord) => {
        const startedAt = attemptRecord.startedAt;
        const submittedAt = attemptRecord.submittedAt;
        const timeTakenMinutes =
          submittedAt && startedAt
            ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 60000))
            : null;
        return {
          attemptId: attemptRecord.id,
          userId: String(attemptRecord.userId),
          studentName: 'user' in attemptRecord && attemptRecord.user?.name ? attemptRecord.user.name : '',
          studentEmail: 'user' in attemptRecord && attemptRecord.user?.email ? attemptRecord.user.email : '',
          status: attemptRecord.status,
          startedAt: attemptRecord.startedAt,
          submittedAt: attemptRecord.submittedAt,
          score: attemptRecord.score ?? 0,
          totalScore: attemptRecord.totalScore ?? 0,
          percentage: attemptRecord.percentage ?? 0,
          timeTakenMinutes,
        };
      }),
      questionStats,
    };
  }

  async exportPracticeTestAnalyticsCSV(
    businessId: number,
    user: { id: number; role: UserRole },
    practiceTestId: string,
  ) {
    logger.info(
      `[test-attempt] exportPracticeTestAnalyticsCSV businessId=${businessId} userId=${user.id} role=${user.role} practiceTestId=${practiceTestId}`,
    );

    this.assertTeacherOrAdmin(user);

    const practiceTest = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!practiceTest) throw new NotFoundError('Practice test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, practiceTest.batchId);
      if (!ok) throw new NotFoundError('Practice test not found');
    }

    const finalAttemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attemptRecords = await attemptRepo.getPracticeTestAnalyticsAttemptsForExport(practiceTestId, finalAttemptStatuses);

    const header = ['attemptId', 'userId', 'userName', 'userEmail', 'status', 'score', 'totalScore', 'percentage', 'startedAt', 'submittedAt'];
    const rows = attemptRecords.map((attemptRecord) => [
      attemptRecord.id,
      String(attemptRecord.userId),
      attemptRecord.user?.name ?? '',
      attemptRecord.user?.email ?? '',
      attemptRecord.status,
      attemptRecord.score ?? 0,
      attemptRecord.totalScore ?? 0,
      attemptRecord.percentage ?? 0,
      attemptRecord.startedAt?.toISOString?.() ?? '',
      attemptRecord.submittedAt?.toISOString?.() ?? '',
    ]);

    return [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  }

  async getExamTestAnalytics(
    businessId: number,
    user: { id: number; role: UserRole },
    examTestId: string,
  ) {
    logger.info(
      `[test-attempt] getExamTestAnalytics businessId=${businessId} userId=${user.id} role=${user.role} examTestId=${examTestId}`,
    );

    this.assertTeacherOrAdmin(user);

    const examTest = await examRepo.findExamTestById(businessId, examTestId);
    if (!examTest) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, examTest.batchId);
      if (!ok) throw new NotFoundError('Exam test not found');
    }

    const finalAttemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attemptRecords = await attemptRepo.getExamTestAnalyticsAttempts(examTestId, finalAttemptStatuses);

    const questionIdList = await attemptRepo.getExamTestQuestionIds(examTestId);
    const correctCountRows = await attemptRepo.getExamTestCorrectCountsByQuestion(examTestId, finalAttemptStatuses);
    const correctCountsByQuestionId = new Map(correctCountRows.map((r) => [r.questionId, r.correctCount]));

    const PASS_THRESHOLD_PERCENT_EXAM = 40;
    const summaryStats = computeAttemptSummaryStats(attemptRecords, { passThresholdPercent: PASS_THRESHOLD_PERCENT_EXAM });
    const { totalAttempts, averageScore, averagePercentage, passRate, highestScore, lowestScore } = summaryStats;

    const questionStats = questionIdList.map((questionId) => {
      const correctCount = correctCountsByQuestionId.get(questionId) ?? 0;
      const accuracy = totalAttempts ? (correctCount / totalAttempts) * 100 : 0;
      return {
        questionId,
        correctCount,
        totalAttempts,
        accuracy,
      };
    });

    return {
      summary: {
        totalAttempts,
        averageScore,
        averagePercentage,
        passRate,
        highestScore,
        lowestScore,
      },
      attempts: attemptRecords.map((attemptRecord) => {
        const startedAt = attemptRecord.startedAt;
        const submittedAt = attemptRecord.submittedAt;
        const timeTakenMinutes =
          submittedAt && startedAt
            ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 60000))
            : null;
        return {
          attemptId: attemptRecord.id,
          userId: String(attemptRecord.userId),
          studentName: 'user' in attemptRecord && attemptRecord.user?.name ? attemptRecord.user.name : '',
          studentEmail: 'user' in attemptRecord && attemptRecord.user?.email ? attemptRecord.user.email : '',
          status: attemptRecord.status,
          startedAt: attemptRecord.startedAt,
          submittedAt: attemptRecord.submittedAt,
          score: attemptRecord.score ?? 0,
          totalScore: attemptRecord.totalScore ?? 0,
          percentage: attemptRecord.percentage ?? 0,
          timeTakenMinutes,
        };
      }),
      questionStats,
    };
  }

  async exportExamTestAnalyticsCSV(
    businessId: number,
    user: { id: number; role: UserRole },
    examTestId: string,
  ) {
    logger.info(
      `[test-attempt] exportExamTestAnalyticsCSV businessId=${businessId} userId=${user.id} role=${user.role} examTestId=${examTestId}`,
    );

    this.assertTeacherOrAdmin(user);

    const examTest = await examRepo.findExamTestById(businessId, examTestId);
    if (!examTest) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, examTest.batchId);
      if (!ok) throw new NotFoundError('Exam test not found');
    }

    const finalAttemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attemptRecords = await attemptRepo.getExamTestAnalyticsAttemptsForExport(examTestId, finalAttemptStatuses);

    const header = ['attemptId', 'userId', 'userName', 'userEmail', 'status', 'score', 'totalScore', 'percentage', 'startedAt', 'submittedAt'];
    const rows = attemptRecords.map((attemptRecord) => [
      attemptRecord.id,
      String(attemptRecord.userId),
      attemptRecord.user?.name ?? '',
      attemptRecord.user?.email ?? '',
      attemptRecord.status,
      attemptRecord.score ?? 0,
      attemptRecord.totalScore ?? 0,
      attemptRecord.percentage ?? 0,
      attemptRecord.startedAt?.toISOString?.() ?? '',
      attemptRecord.submittedAt?.toISOString?.() ?? '',
    ]);

    return [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  }
}



export const testAttemptService = new TestAttemptService();
