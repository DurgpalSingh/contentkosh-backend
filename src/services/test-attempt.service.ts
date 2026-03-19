import { UserRole } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { AttemptStatus, LockedReason, QuestionType, ResultVisibilityExam, TestStatus } from '../constants/test-enums';
import logger from '../utils/logger';
import * as attemptRepo from '../repositories/test-attempt.repo';
import * as practiceRepo from '../repositories/practice-test.repo';
import * as examRepo from '../repositories/exam-test.repo';
import * as questionRepo from '../repositories/test-question.repo';
import * as batchUserRepo from '../repositories/batch.repo';

type SubmitAnswerPayload = {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
};

function stableHashToUint32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededRng(seed: string): () => number {
  // Mulberry32
  let a = stableHashToUint32(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

function normalizeNumeric(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function assertStudentInBatch(userId: number, batchId: number) {
  const ok = await batchUserRepo.isActiveUserInBatch(userId, batchId);
  if (!ok) {
    throw new BadRequestError('Student is not an active member of this batch');
  }
}

function mapAttempt(a: any) {
  return {
    id: a.id,
    practiceTestId: a.practiceTestId ?? null,
    examTestId: a.examTestId ?? null,
    userId: a.userId,
    status: a.status,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt ?? null,
    score: a.score ?? null,
    totalScore: a.totalScore ?? null,
    percentage: a.percentage ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function mapAnswer(a: any) {
  return {
    id: a.id,
    attemptId: a.attemptId,
    questionId: a.questionId,
    selectedOptionIds: a.selectedOptionIds ?? [],
    textAnswer: a.textAnswer ?? null,
    isCorrect: a.isCorrect ?? null,
    obtainedMarks: a.obtainedMarks ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export class TestAttemptService {
  async startPracticeAttempt(businessId: number, user: { id: number; role: UserRole }, practiceTestId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can start attempts');
    logger.info(`[test-attempt] startPracticeAttempt businessId=${businessId} userId=${user.id} practiceTestId=${practiceTestId}`);

    const test = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!test) throw new NotFoundError('Practice test not found');
    if (test.status !== TestStatus.PUBLISHED) throw new BadRequestError('Practice test is not published');

    await assertStudentInBatch(user.id, test.batchId);

    const attempt = await attemptRepo.createTestAttempt({
      practiceTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    const questions = await questionRepo.listPracticeTestQuestions(businessId, practiceTestId);
    const rng = seededRng(`practice:${attempt.id}`);
    const qs = questions.map((q: any) => ({ ...q, options: [...(q.options ?? [])] }));
    if (test.shuffleQuestions) shuffleInPlace(qs, rng);
    if (test.shuffleOptions) qs.forEach((q: any) => shuffleInPlace(q.options, rng));

    logger.info(`[test-attempt] practice attempt started attemptId=${attempt.id} questions=${qs.length}`);
    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      test,
      questions: qs,
    };
  }

  async startExamAttempt(businessId: number, user: { id: number; role: UserRole }, examTestId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can start attempts');
    logger.info(`[test-attempt] startExamAttempt businessId=${businessId} userId=${user.id} examTestId=${examTestId}`);

    const test = await examRepo.findExamTestById(businessId, examTestId);
    if (!test) throw new NotFoundError('Exam test not found');
    if (test.status !== TestStatus.PUBLISHED) throw new BadRequestError('Exam test is not published');

    await assertStudentInBatch(user.id, test.batchId);

    const now = new Date();
    const nowMs = now.getTime();
    const startAtMs = new Date(test.startAt).getTime();
    const deadlineAtMs = new Date(test.deadlineAt).getTime();
    logger.info(`[test-attempt] exam timing now=${now.toISOString()} startAt=${new Date(test.startAt).toISOString()} deadlineAt=${new Date(test.deadlineAt).toISOString()}`);
    // 1s tolerance to avoid clock drift/jitter
    if (nowMs + 1000 < startAtMs) throw new BadRequestError('Exam has not started yet');
    if (nowMs > deadlineAtMs) throw new BadRequestError('Exam deadline has passed');

    const existingAttempts = await attemptRepo.findExamAttemptsByUser(examTestId, user.id, {
      where: { status: { in: [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] } as any },
      take: 1,
    });
    if (existingAttempts.length) throw new BadRequestError('You have already attempted this exam');

    const attempt = await attemptRepo.createTestAttempt({
      examTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
    });

    const questions = await questionRepo.listExamTestQuestions(businessId, examTestId);
    const rng = seededRng(`exam:${attempt.id}`);
    const qs = questions.map((q: any) => ({ ...q, options: [...(q.options ?? [])] }));
    if (test.shuffleQuestions) shuffleInPlace(qs, rng);
    if (test.shuffleOptions) qs.forEach((q: any) => shuffleInPlace(q.options, rng));

    logger.info(`[test-attempt] exam attempt started attemptId=${attempt.id} questions=${qs.length} effectiveWindow=${test.startAt.toISOString()}..${test.deadlineAt.toISOString()}`);
    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      test,
      questions: qs,
    };
  }

  private computeExamEffectiveEnd(test: any, attempt: any): Date {
    const started = new Date(attempt.startedAt);
    const durationMs = Number(test.durationMinutes) * 60_000;
    const byDuration = new Date(started.getTime() + durationMs);
    return byDuration < test.deadlineAt ? byDuration : test.deadlineAt;
  }

  private shouldRevealExamResults(test: any, now: Date): boolean {
    if (test.resultVisibility === ResultVisibilityExam.HIDDEN) return false;
    // AFTER_DEADLINE
    return now >= test.deadlineAt;
  }

  async getPracticeAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');

    const attempt: any = await attemptRepo.findTestAttemptById(attemptId, {
      include: {
        practiceTest: true,
        answers: true,
      },
    });
    if (!attempt?.practiceTestId || !attempt.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attempt.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');

    await assertStudentInBatch(user.id, attempt.practiceTest.batchId);

    const questions = await questionRepo.listPracticeTestQuestions(businessId, attempt.practiceTestId);
    const rng = seededRng(`practice:${attempt.id}`);
    const qs = questions.map((q: any) => ({ ...q, options: [...(q.options ?? [])] }));
    if (attempt.practiceTest.shuffleQuestions) shuffleInPlace(qs, rng);
    if (attempt.practiceTest.shuffleOptions) qs.forEach((q: any) => shuffleInPlace(q.options, rng));

    return {
      attempt: mapAttempt(attempt),
      test: attempt.practiceTest,
      questions: qs,
      answers: (attempt.answers ?? []).map(mapAnswer),
      revealResults: true,
    };
  }

  async getExamAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');

    const attempt: any = await attemptRepo.findTestAttemptById(attemptId, {
      include: {
        examTest: true,
        answers: true,
      },
    });
    if (!attempt?.examTestId || !attempt.examTest) throw new NotFoundError('Exam attempt not found');
    if (attempt.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');

    await assertStudentInBatch(user.id, attempt.examTest.batchId);

    const questions = await questionRepo.listExamTestQuestions(businessId, attempt.examTestId);
    const rng = seededRng(`exam:${attempt.id}`);
    const qs = questions.map((q: any) => ({ ...q, options: [...(q.options ?? [])] }));
    if (attempt.examTest.shuffleQuestions) shuffleInPlace(qs, rng);
    if (attempt.examTest.shuffleOptions) qs.forEach((q: any) => shuffleInPlace(q.options, rng));

    const now = new Date();
    const reveal = this.shouldRevealExamResults(attempt.examTest, now);

    return {
      attempt: mapAttempt(reveal ? attempt : { ...attempt, score: null, totalScore: null, percentage: null }),
      test: attempt.examTest,
      questions: qs,
      answers: reveal ? (attempt.answers ?? []).map(mapAnswer) : [],
      revealResults: reveal,
      effectiveEndAt: this.computeExamEffectiveEnd(attempt.examTest, attempt),
    };
  }

  private evaluateQuestion(params: {
    question: any;
    provided: SubmitAnswerPayload | undefined;
    isExam: boolean;
    defaultMarksPerQuestion: number;
    negativeMarksPerQuestion: number;
  }): { isCorrect: boolean | null; obtainedMarks: number | null; selectedOptionIds: string[]; textAnswer: string | null } {
    const { question, provided, isExam, defaultMarksPerQuestion, negativeMarksPerQuestion } = params;

    const selectedOptionIds = (provided?.selectedOptionIds ?? []).filter(Boolean);
    const textAnswer = provided?.textAnswer !== undefined ? String(provided.textAnswer) : null;

    const answered =
      (selectedOptionIds.length > 0) ||
      (textAnswer !== null && textAnswer.trim().length > 0);

    if (!answered) {
      return { isCorrect: null, obtainedMarks: 0, selectedOptionIds: [], textAnswer: textAnswer?.trim().length ? textAnswer : null };
    }

    const type = question.type;
    const isMcq = type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE;
    const isText = type === QuestionType.TRUE_FALSE || type === QuestionType.NUMERICAL || type === QuestionType.FILL_IN_THE_BLANK;

    let correct = false;

    if (isMcq) {
      const correctIds: string[] = (question.correctOptionIdsAnswers ?? []).filter(Boolean);
      const a = new Set(selectedOptionIds);
      const b = new Set(correctIds);
      if (a.size === b.size) {
        correct = true;
        for (const id of a) {
          if (!b.has(id)) {
            correct = false;
            break;
          }
        }
      }
    } else if (isText) {
      const expected = question.correctTextAnswer ?? '';
      if (type === QuestionType.NUMERICAL) {
        const e = normalizeNumeric(expected);
        const p = normalizeNumeric(textAnswer ?? '');
        correct = e !== null && p !== null && e === p;
      } else {
        correct = normalizeText(expected) === normalizeText(textAnswer ?? '');
      }
    } else {
      correct = false;
    }

    if (correct) {
      return { isCorrect: true, obtainedMarks: defaultMarksPerQuestion, selectedOptionIds, textAnswer };
    }

    const obtainedMarks = isExam ? -negativeMarksPerQuestion : 0;
    return { isCorrect: false, obtainedMarks, selectedOptionIds, textAnswer };
  }

  async submitPracticeAttempt(
    businessId: number,
    user: { id: number; role: UserRole },
    attemptId: string,
    answers: SubmitAnswerPayload[],
  ) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can submit attempts');
    logger.info(`[test-attempt] submitPracticeAttempt businessId=${businessId} userId=${user.id} attemptId=${attemptId} answers=${answers?.length ?? 0}`);

    const attempt: any = await attemptRepo.findTestAttemptById(attemptId, {
      include: { practiceTest: true },
    });
    if (!attempt?.practiceTestId || !attempt.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attempt.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new BadRequestError('Attempt is not in progress');

    await assertStudentInBatch(user.id, attempt.practiceTest.batchId);

    const questions = await questionRepo.listPracticeTestQuestions(businessId, attempt.practiceTestId);
    const questionIds = new Set(questions.map((q: any) => q.id));
    for (const a of answers ?? []) {
      if (!questionIds.has(a.questionId)) {
        throw new BadRequestError(`Invalid questionId in answers: ${a.questionId}`);
      }
    }

    const byQuestion = new Map<string, SubmitAnswerPayload>();
    for (const a of answers ?? []) byQuestion.set(a.questionId, a);

    const defaultMarksPerQuestion = Number(attempt.practiceTest.defaultMarksPerQuestion) ?? 1;
    const totalScore = defaultMarksPerQuestion * questions.length;

    const evaluated = questions.map((q: any) => {
      const ev = this.evaluateQuestion({
        question: q,
        provided: byQuestion.get(q.id),
        isExam: false,
        defaultMarksPerQuestion,
        negativeMarksPerQuestion: 0,
      });
      return { questionId: q.id, ...ev };
    });

    const score = evaluated.reduce((sum, e) => sum + (e.obtainedMarks ?? 0), 0);
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    const submittedAt = new Date();

    await attemptRepo.upsertAttemptAnswersAndFinalize({
      attemptId,
      evaluated,
      attemptUpdate: {
        status: AttemptStatus.SUBMITTED,
        submittedAt,
        score,
        totalScore,
        percentage,
      },
    });

    const updatedAttempt: any = await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } });
    logger.info(`[test-attempt] practice attempt evaluated attemptId=${attemptId} score=${score} totalScore=${totalScore} percentage=${percentage}`);
    return {
      attempt: updatedAttempt ? mapAttempt(updatedAttempt) : mapAttempt({ ...attempt, status: AttemptStatus.SUBMITTED, submittedAt, score, totalScore, percentage }),
      revealResults: true,
      score,
      totalScore,
      percentage,
      answers: updatedAttempt?.answers?.map(mapAnswer) ?? [],
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

    const attempt: any = await attemptRepo.findTestAttemptById(attemptId, {
      include: { examTest: true },
    });
    if (!attempt?.examTestId || !attempt.examTest) throw new NotFoundError('Exam attempt not found');
    if (attempt.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new BadRequestError('Attempt is not in progress');

    await assertStudentInBatch(user.id, attempt.examTest.batchId);

    const questions = await questionRepo.listExamTestQuestions(businessId, attempt.examTestId);
    const questionIds = new Set(questions.map((q: any) => q.id));
    for (const a of answers ?? []) {
      if (!questionIds.has(a.questionId)) {
        throw new BadRequestError(`Invalid questionId in answers: ${a.questionId}`);
      }
    }

    const byQuestion = new Map<string, SubmitAnswerPayload>();
    for (const a of answers ?? []) byQuestion.set(a.questionId, a);

    const defaultMarksPerQuestion = Number(attempt.examTest.defaultMarksPerQuestion) ?? 1;
    const negativeMarksPerQuestion = Number(attempt.examTest.negativeMarksPerQuestion) ?? 0;
    const totalScore = defaultMarksPerQuestion * questions.length;

    const evaluated = questions.map((q: any) => {
      const ev = this.evaluateQuestion({
        question: q,
        provided: byQuestion.get(q.id),
        isExam: true,
        defaultMarksPerQuestion,
        negativeMarksPerQuestion,
      });
      return { questionId: q.id, ...ev };
    });

    const score = evaluated.reduce((sum, e) => sum + (e.obtainedMarks ?? 0), 0);
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    const submittedAt = new Date();

    const effectiveEnd = this.computeExamEffectiveEnd(attempt.examTest, attempt);
    const status = submittedAt > effectiveEnd ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED;

    await attemptRepo.upsertAttemptAnswersAndFinalize({
      attemptId,
      evaluated,
      attemptUpdate: {
        status,
        submittedAt,
        score,
        totalScore,
        percentage,
      },
    });

    const now = new Date();
    const reveal = this.shouldRevealExamResults(attempt.examTest, now);
    const updatedAttempt: any = await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } });
    logger.info(
      `[test-attempt] exam attempt evaluated attemptId=${attemptId} status=${status} score=${score} totalScore=${totalScore} percentage=${percentage} reveal=${reveal} effectiveEndAt=${effectiveEnd.toISOString()}`,
    );

    return {
      attempt: updatedAttempt ? mapAttempt(reveal ? updatedAttempt : { ...updatedAttempt, score: null, totalScore: null, percentage: null }) : mapAttempt({ ...attempt, status, submittedAt, ...(reveal ? { score, totalScore, percentage } : { score: null, totalScore: null, percentage: null }) }),
      revealResults: reveal,
      ...(reveal ? { score, totalScore, percentage, answers: updatedAttempt?.answers?.map(mapAnswer) ?? [] } : { answers: [] }),
      effectiveEndAt: effectiveEnd,
    };
  }

  async listAvailablePracticeTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailablePracticeTests businessId=${businessId} userId=${user.id}`);
    const tests = await practiceRepo.findPublishedPracticeTestsForStudent(businessId, user.id);

    const out = [];
    for (const t of tests) {
      const stats = await attemptRepo.getPracticeAttemptStats(t.id, user.id);
      out.push({
        practiceTestId: t.id,
        batchId: t.batchId,
        name: t.name,
        description: t.description ?? null,
        canAttempt: true,
        attemptCount: stats.attemptCount,
        bestScore: stats.bestScore,
        lastAttemptAt: stats.lastAttemptAt,
      });
    }
    return out;
  }

  async listAvailableExamTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailableExamTests businessId=${businessId} userId=${user.id}`);
    const tests = await examRepo.findPublishedExamTestsForStudent(businessId, user.id);

    const now = new Date();
    const nowMs = now.getTime();

    const out = [];
    for (const t of tests) {
      const stats = await attemptRepo.getExamAttemptStats(t.id, user.id);

      let canAttempt = true;
      let lockedReason: number | null = null;

      const startAtMs = new Date(t.startAt).getTime();
      const deadlineAtMs = new Date(t.deadlineAt).getTime();

      if (nowMs + 1000 < startAtMs) {
        canAttempt = false;
        lockedReason = LockedReason.NOT_STARTED;
      } else if (nowMs > deadlineAtMs) {
        canAttempt = false;
        lockedReason = LockedReason.DEADLINE_PASSED;
      } else if (stats.attemptCount > 0) {
        canAttempt = false;
        lockedReason = LockedReason.ALREADY_ATTEMPTED;
      }

      out.push({
        examTestId: t.id,
        batchId: t.batchId,
        name: t.name,
        description: t.description ?? null,
        startAt: t.startAt,
        deadlineAt: t.deadlineAt,
        durationMinutes: t.durationMinutes,
        canAttempt,
        lockedReason,
        hasAttempt: stats.attemptCount > 0,
        attemptsUsed: stats.attemptCount,
        bestScore: stats.bestScore,
        lastAttemptAt: stats.lastAttemptAt,
      });
    }
    return out;
  }
}

