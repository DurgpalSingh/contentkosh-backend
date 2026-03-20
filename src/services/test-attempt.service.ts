import { Prisma, UserRole, ExamTest, PracticeTest, TestAttempt, TestAttemptAnswer, TestOption, TestQuestion } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';
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

type QuestionOptionRecord = Pick<TestOption, 'id' | 'text' | 'mediaUrl'>;
type QuestionRecord = Pick<TestQuestion, 'id' | 'type' | 'text' | 'correctTextAnswer' | 'correctOptionIdsAnswers' | 'mediaUrl'> & {
  options: QuestionOptionRecord[];
};

type AttemptRecord = Pick<
  TestAttempt,
  'id' | 'practiceTestId' | 'examTestId' | 'userId' | 'status' | 'startedAt' | 'submittedAt' | 'score' | 'totalScore' | 'percentage'
>;

type PracticeAttemptWithRelations = Prisma.TestAttemptGetPayload<{ include: { practiceTest: true; answers: true } }>;
type ExamAttemptWithRelations = Prisma.TestAttemptGetPayload<{ include: { examTest: true; answers: true } }>;
type AttemptWithAnswers = Prisma.TestAttemptGetPayload<{ include: { answers: true } }>;
type PracticeAttemptWithTest = Prisma.TestAttemptGetPayload<{ include: { practiceTest: true } }>;
type ExamAttemptWithTest = Prisma.TestAttemptGetPayload<{ include: { examTest: true } }>;

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

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Wrap values containing special chars in quotes and escape embedded quotes.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function assertStudentInBatch(userId: number, batchId: number) {
  const ok = await batchUserRepo.isActiveUserInBatch(userId, batchId);
  if (!ok) {
    logger.warn(`[test-attempt] student not in batch userId=${userId} batchId=${batchId}`);
    throw new BadRequestError('Student is not an active member of this batch');
  }
}

function mapAttempt(a: AttemptRecord) {
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
  };
}

function mapAnswer(a: TestAttemptAnswer) {
  return {
    questionId: a.questionId,
    selectedOptionIds: a.selectedOptionIds ?? [],
    textAnswer: a.textAnswer ?? null,
    isCorrect: a.isCorrect ?? null,
    obtainedMarks: a.obtainedMarks ?? null,
  };
}

function hasExamStarted(now: Date, startAt: Date): boolean {
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

  async startPracticeAttempt(businessId: number, user: { id: number; role: UserRole }, practiceTestId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can start attempts');
    logger.info(`[test-attempt] startPracticeAttempt businessId=${businessId} userId=${user.id} practiceTestId=${practiceTestId}`);

    const test = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!test) {
      logger.warn(`[test-attempt] practice test not found businessId=${businessId} practiceTestId=${practiceTestId}`);
      throw new NotFoundError('Practice test not found');
    }
    if (test.status !== TestStatus.PUBLISHED) {
      logger.warn(`[test-attempt] practice test not published practiceTestId=${practiceTestId} status=${test.status}`);
      throw new BadRequestError('Practice test is not published');
    }

    await assertStudentInBatch(user.id, test.batchId);

    const inProgress = await attemptRepo.findPracticeAttemptsByUser(practiceTestId, user.id, {
      where: { status: AttemptStatus.IN_PROGRESS },
      take: 1,
    });
    if (inProgress.length) {
      const attempt = inProgress[0];
      if (!attempt) {
        logger.warn(`[test-attempt] practice attempt resume failed: missing attempt record practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Practice attempt not found');
      }
      const questions = (await questionRepo.listPracticeTestQuestions(businessId, practiceTestId)) as QuestionRecord[];
      if (!questions.length) {
        logger.warn(`[test-attempt] practice attempt resume blocked: no questions practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Practice test has no questions');
      }
      const rng = seededRng(`practice:${attempt.id}`);
      const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
      if (test.shuffleQuestions) shuffleInPlace(qs, rng);
      if (test.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

      logger.info(`[test-attempt] practice attempt resumed attemptId=${attempt.id} questions=${qs.length}`);
      return {
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        test,
        questions: qs,
      };
    }

    const attempt = await attemptRepo.createTestAttempt({
      practiceTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    const questions = (await questionRepo.listPracticeTestQuestions(businessId, practiceTestId)) as QuestionRecord[];
    if (!questions.length) {
      logger.warn(`[test-attempt] practice attempt blocked: no questions practiceTestId=${practiceTestId}`);
      throw new BadRequestError('Practice test has no questions');
    }
    const rng = seededRng(`practice:${attempt.id}`);
    const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
    if (test.shuffleQuestions) shuffleInPlace(qs, rng);
    if (test.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

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
    if (!test) {
      logger.warn(`[test-attempt] exam test not found businessId=${businessId} examTestId=${examTestId}`);
      throw new NotFoundError('Exam test not found');
    }
    if (test.status !== TestStatus.PUBLISHED) {
      logger.warn(`[test-attempt] exam test not published examTestId=${examTestId} status=${test.status}`);
      throw new BadRequestError('Exam test is not published');
    }

    await assertStudentInBatch(user.id, test.batchId);

    const now = new Date();
    const nowMs = now.getTime();
    const deadlineAtMs = test.deadlineAt.getTime();
    logger.info(`[test-attempt] exam timing now=${now.toISOString()} startAt=${test.startAt.toISOString()} deadlineAt=${test.deadlineAt.toISOString()}`);
    // 1s tolerance to avoid clock drift/jitter
    if (!hasExamStarted(now, test.startAt)) {
      logger.warn(`[test-attempt] exam not started examTestId=${examTestId} now=${now.toISOString()} startAt=${test.startAt.toISOString()}`);
      throw new BadRequestError('Exam has not started yet');
    }
    if (nowMs > deadlineAtMs) {
      logger.warn(`[test-attempt] exam deadline passed examTestId=${examTestId} now=${now.toISOString()} deadlineAt=${test.deadlineAt.toISOString()}`);
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
      const attempt = inProgressAttempts[0];
      if (!attempt) {
        logger.warn(`[test-attempt] exam attempt resume failed: missing attempt record examTestId=${examTestId}`);
        throw new BadRequestError('Exam attempt not found');
      }
      const questions = (await questionRepo.listExamTestQuestions(businessId, examTestId)) as QuestionRecord[];
      if (!questions.length) {
        logger.warn(`[test-attempt] exam attempt resume blocked: no questions examTestId=${examTestId}`);
        throw new BadRequestError('Exam test has no questions');
      }
      const rng = seededRng(`exam:${attempt.id}`);
      const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
      if (test.shuffleQuestions) shuffleInPlace(qs, rng);
      if (test.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

      logger.info(`[test-attempt] exam attempt resumed attemptId=${attempt.id} questions=${qs.length}`);
      return {
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        test,
        questions: qs,
      };
    }

    const attempt = await attemptRepo.createTestAttempt({
      examTestId,
      userId: user.id,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
    });

    const questions = (await questionRepo.listExamTestQuestions(businessId, examTestId)) as QuestionRecord[];
    if (!questions.length) {
      logger.warn(`[test-attempt] exam attempt blocked: no questions examTestId=${examTestId}`);
      throw new BadRequestError('Exam test has no questions');
    }
    const rng = seededRng(`exam:${attempt.id}`);
    const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
    if (test.shuffleQuestions) shuffleInPlace(qs, rng);
    if (test.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

    logger.info(`[test-attempt] exam attempt started attemptId=${attempt.id} questions=${qs.length} effectiveWindow=${test.startAt.toISOString()}..${test.deadlineAt.toISOString()}`);
    return {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      test,
      questions: qs,
    };
  }

  private computeExamEffectiveEnd(test: ExamTest, attempt: TestAttempt): Date {
    const started = new Date(attempt.startedAt);
    const durationMs = Number(test.durationMinutes) * 60_000;
    const byDuration = new Date(started.getTime() + durationMs);
    return byDuration < test.deadlineAt ? byDuration : test.deadlineAt;
  }

  private shouldRevealExamResults(test: ExamTest, now: Date): boolean {
    if (test.resultVisibility === ResultVisibilityExam.HIDDEN) return false;
    // AFTER_DEADLINE
    return now >= test.deadlineAt;
  }

  async getPracticeAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');

    const attempt = (await attemptRepo.findTestAttemptById(attemptId, {
      include: {
        practiceTest: true,
        answers: true,
      },
    })) as PracticeAttemptWithRelations | null;
    if (!attempt?.practiceTestId || !attempt.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attempt.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');

    await assertStudentInBatch(user.id, attempt.practiceTest.batchId);

    const questions = (await questionRepo.listPracticeTestQuestions(businessId, attempt.practiceTestId)) as QuestionRecord[];
    const rng = seededRng(`practice:${attempt.id}`);
    const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
    if (attempt.practiceTest.shuffleQuestions) shuffleInPlace(qs, rng);
    if (attempt.practiceTest.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

    return {
      attempt: mapAttempt(attempt),
      test: attempt.practiceTest,
      questions: qs,
      answers: (attempt.answers ?? []).map(mapAnswer),
    };
  }

  async getExamAttemptDetails(businessId: number, user: { id: number; role: UserRole }, attemptId: string) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can view attempts');

    const attempt = (await attemptRepo.findTestAttemptById(attemptId, {
      include: {
        examTest: true,
        answers: true,
      },
    })) as ExamAttemptWithRelations | null;
    if (!attempt?.examTestId || !attempt.examTest) throw new NotFoundError('Exam attempt not found');
    if (attempt.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');

    await assertStudentInBatch(user.id, attempt.examTest.batchId);

    const questions = (await questionRepo.listExamTestQuestions(businessId, attempt.examTestId)) as QuestionRecord[];
    const rng = seededRng(`exam:${attempt.id}`);
    const qs = questions.map((q) => ({ ...q, options: [...q.options] }));
    if (attempt.examTest.shuffleQuestions) shuffleInPlace(qs, rng);
    if (attempt.examTest.shuffleOptions) qs.forEach((q) => shuffleInPlace(q.options, rng));

    const now = new Date();
    const reveal = this.shouldRevealExamResults(attempt.examTest, now);

    const maskedAttempt: AttemptRecord = reveal
      ? attempt
      : { ...attempt, score: null, totalScore: null, percentage: null };

    return {
      attempt: mapAttempt(maskedAttempt),
      test: attempt.examTest,
      questions: qs,
      answers: reveal ? (attempt.answers ?? []).map(mapAnswer) : [],
    };
  }

  private evaluateQuestion(params: {
    question: QuestionRecord;
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

    const attempt = (await attemptRepo.findTestAttemptById(attemptId, {
      include: { practiceTest: true },
    })) as PracticeAttemptWithTest | null;
    if (!attempt?.practiceTestId || !attempt.practiceTest) throw new NotFoundError('Practice attempt not found');
    if (attempt.practiceTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      logger.info(`[test-attempt] practice attempt already submitted attemptId=${attemptId} status=${attempt.status}`);
      const existing = (await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } })) as AttemptWithAnswers | null;
      const submittedAt = attempt.submittedAt ?? existing?.submittedAt ?? new Date();
      return {
        attemptId,
        status: attempt.status,
        score: attempt.score ?? 0,
        totalScore: attempt.totalScore ?? 0,
        percentage: attempt.percentage ?? 0,
        answers: existing?.answers?.map(mapAnswer) ?? [],
        submittedAt,
      };
    }

    await assertStudentInBatch(user.id, attempt.practiceTest.batchId);

    const questions = (await questionRepo.listPracticeTestQuestions(businessId, attempt.practiceTestId)) as QuestionRecord[];
    const questionIds = new Set(questions.map((q) => q.id));
    const providedAnswers = answers ?? [];
    const invalidAnswer = providedAnswers.find((a) => !questionIds.has(a.questionId));
    if (invalidAnswer) {
      throw new BadRequestError(`Invalid questionId in answers: ${invalidAnswer.questionId}`);
    }

    const byQuestion = new Map<string, SubmitAnswerPayload>(providedAnswers.map((a) => [a.questionId, a]));

    const rawDefaultMarks = Number(attempt.practiceTest.defaultMarksPerQuestion);
    const defaultMarksPerQuestion = Number.isFinite(rawDefaultMarks) ? rawDefaultMarks : 1;
    const totalScore = defaultMarksPerQuestion * questions.length;

    const evaluated = questions.map((q) => {
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

    const updatedAttempt = (await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } })) as AttemptWithAnswers | null;
    logger.info(`[test-attempt] practice attempt evaluated attemptId=${attemptId} score=${score} totalScore=${totalScore} percentage=${percentage}`);
    const submitted = updatedAttempt?.submittedAt ?? submittedAt;
    return {
      attemptId,
      status: updatedAttempt?.status ?? AttemptStatus.SUBMITTED,
      score,
      totalScore,
      percentage,
      answers: updatedAttempt?.answers?.map(mapAnswer) ?? [],
      submittedAt: submitted,
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

    const attempt = (await attemptRepo.findTestAttemptById(attemptId, {
      include: { examTest: true },
    })) as ExamAttemptWithTest | null;
    if (!attempt?.examTestId || !attempt.examTest) throw new NotFoundError('Exam attempt not found');
    if (attempt.examTest.businessId !== businessId) throw new BadRequestError('Invalid business scope');
    if (attempt.userId !== user.id) throw new BadRequestError('Forbidden');
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      logger.info(`[test-attempt] exam attempt already submitted attemptId=${attemptId} status=${attempt.status}`);
      const existing = (await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } })) as AttemptWithAnswers | null;
      const submittedAt = attempt.submittedAt ?? existing?.submittedAt ?? new Date();
      const now = new Date();
      const reveal = this.shouldRevealExamResults(attempt.examTest, now);
      if (!reveal) {
        return {
          attemptId,
          status: attempt.status,
          submittedAt,
        };
      }
      return {
        attemptId,
        status: attempt.status,
        score: attempt.score ?? 0,
        totalScore: attempt.totalScore ?? 0,
        percentage: attempt.percentage ?? 0,
        answers: existing?.answers?.map(mapAnswer) ?? [],
        submittedAt,
      };
    }

    await assertStudentInBatch(user.id, attempt.examTest.batchId);

    const questions = (await questionRepo.listExamTestQuestions(businessId, attempt.examTestId)) as QuestionRecord[];
    const questionIds = new Set(questions.map((q) => q.id));
    const providedAnswers = answers ?? [];
    const invalidAnswer = providedAnswers.find((a) => !questionIds.has(a.questionId));
    if (invalidAnswer) {
      throw new BadRequestError(`Invalid questionId in answers: ${invalidAnswer.questionId}`);
    }

    const byQuestion = new Map<string, SubmitAnswerPayload>(providedAnswers.map((a) => [a.questionId, a]));

    const rawDefaultMarks = Number(attempt.examTest.defaultMarksPerQuestion);
    const defaultMarksPerQuestion = Number.isFinite(rawDefaultMarks) ? rawDefaultMarks : 1;
    const rawNegativeMarks = Number(attempt.examTest.negativeMarksPerQuestion);
    const negativeMarksPerQuestion = Number.isFinite(rawNegativeMarks) ? rawNegativeMarks : 0;
    const totalScore = defaultMarksPerQuestion * questions.length;

    const evaluated = questions.map((q) => {
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
    const updatedAttempt = (await attemptRepo.findTestAttemptById(attemptId, { include: { answers: true } })) as AttemptWithAnswers | null;
    logger.info(
      `[test-attempt] exam attempt evaluated attemptId=${attemptId} status=${status} score=${score} totalScore=${totalScore} percentage=${percentage} reveal=${reveal} effectiveEndAt=${effectiveEnd.toISOString()}`,
    );

    const submitted = updatedAttempt?.submittedAt ?? submittedAt;
    if (!reveal) {
      return {
        attemptId,
        status: updatedAttempt?.status ?? status,
        submittedAt: submitted,
      };
    }

    return {
      attemptId,
      status: updatedAttempt?.status ?? status,
      score,
      totalScore,
      percentage,
      answers: updatedAttempt?.answers?.map(mapAnswer) ?? [],
      submittedAt: submitted,
    };
  }

  async listAvailablePracticeTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailablePracticeTests businessId=${businessId} userId=${user.id}`);
    const tests = (await practiceRepo.findPublishedPracticeTestsForStudent(businessId, user.id)) as Array<
      PracticeTest & { _count?: { questions?: number } }
    >;
    logger.info(`[test-attempt] available practice tests count=${tests.length} businessId=${businessId} userId=${user.id}`);
    const statsByTestId = await attemptRepo.getPracticeAttemptStatsByUserForTests(
      tests.map((t) => t.id),
      user.id,
    );

    return tests.map((t) => {
      const stats = statsByTestId.get(t.id) ?? { attemptCount: 0, bestScore: null, lastAttemptAt: null, lastAttemptId: null };
      const totalQuestions = t._count?.questions ?? 0;
      const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);
      const hasAttempt = stats.attemptCount > 0;
      return {
        id: t.id,
        businessId,
        batchId: t.batchId,
        name: t.name,
        description: t.description ?? null,
        status: t.status,
        totalQuestions,
        totalMarks,
        defaultMarksPerQuestion: t.defaultMarksPerQuestion,
        canAttempt: true,
        ...(hasAttempt
          ? {
              attemptId: stats.lastAttemptId ?? null,
              attemptCount: stats.attemptCount,
              bestScore: stats.bestScore,
              lastAttemptAt: stats.lastAttemptAt,
            }
          : {}),
      };
    });
  }

  async listAvailableExamTests(businessId: number, user: { id: number; role: UserRole }) {
    if (user.role !== UserRole.STUDENT) throw new BadRequestError('Only students can access available tests');
    logger.info(`[test-attempt] listAvailableExamTests businessId=${businessId} userId=${user.id}`);
    const tests = (await examRepo.findPublishedExamTestsForStudent(businessId, user.id)) as Array<
      ExamTest & { _count?: { questions?: number } }
    >;
    logger.info(`[test-attempt] available exam tests count=${tests.length} businessId=${businessId} userId=${user.id}`);

    const now = new Date();
    const nowMs = now.getTime();

    const statsByTestId = await attemptRepo.getExamAttemptStatsByUserForTests(
      tests.map((t) => t.id),
      user.id,
    );

    return tests.map((t) => {
      const stats = statsByTestId.get(t.id) ?? { attemptCount: 0, bestScore: null, lastAttemptAt: null, lastAttemptId: null };
      const attemptsAllowed = 1;
      const attemptsUsed = stats.attemptCount;
      const hasAttempt = attemptsUsed > 0;
      const totalQuestions = t._count?.questions ?? 0;
      const totalMarks = totalQuestions * Number(t.defaultMarksPerQuestion ?? 0);

      let canAttempt = true;
      let lockedReason: number | null = null;

      const deadlineAtMs = t.deadlineAt.getTime();

      if (!hasExamStarted(now, t.startAt)) {
        canAttempt = false;
        lockedReason = LockedReason.NOT_STARTED;
      } else if (nowMs > deadlineAtMs) {
        canAttempt = false;
        lockedReason = LockedReason.DEADLINE_PASSED;
      } else if (attemptsUsed >= attemptsAllowed) {
        canAttempt = false;
        lockedReason = LockedReason.ALREADY_ATTEMPTED;
      }

      return {
        id: t.id,
        businessId,
        batchId: t.batchId,
        name: t.name,
        description: t.description ?? null,
        status: t.status,
        startAt: t.startAt,
        deadlineAt: t.deadlineAt,
        durationMinutes: t.durationMinutes,
        totalQuestions,
        totalMarks,
        defaultMarksPerQuestion: t.defaultMarksPerQuestion,
        negativeMarksPerQuestion: t.negativeMarksPerQuestion,
        resultVisibility: t.resultVisibility,
        canAttempt,
        lockedReason,
        attemptsAllowed,
        attemptsUsed,
        hasAttempt,
        ...(hasAttempt ? { attemptId: stats.lastAttemptId ?? null } : {}),
        lastAttemptAt: stats.lastAttemptAt,
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

    const test = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!test) throw new NotFoundError('Practice test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, test.batchId);
      if (!ok) throw new NotFoundError('Practice test not found');
    }

    const attemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attempts = await attemptRepo.getPracticeTestAnalyticsAttempts(practiceTestId, attemptStatuses);
    const totalAttempts = attempts.length;

    const questionIds = await attemptRepo.getPracticeTestQuestionIds(practiceTestId);
    const correctCountsRows = await attemptRepo.getPracticeTestCorrectCountsByQuestion(practiceTestId, attemptStatuses);
    const correctCounts = new Map(correctCountsRows.map((r) => [r.questionId, r.correctCount]));

    const scores = attempts.map((a) => a.score ?? 0);
    const percentages = attempts.map((a) => a.percentage ?? 0);

    const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
    const averageScore = totalAttempts ? sum(scores) / totalAttempts : 0;
    const averagePercentage = totalAttempts ? sum(percentages) / totalAttempts : 0;
    const highestScore = totalAttempts ? Math.max(...scores) : 0;
    const lowestScore = totalAttempts ? Math.min(...scores) : 0;

    // No explicit passing threshold was defined in the plan/swagger; use 50% as the default "pass" line.
    const PASS_THRESHOLD_PERCENT = 50;
    const passCount = attempts.filter((a) => (a.percentage ?? 0) >= PASS_THRESHOLD_PERCENT).length;
    const passRate = totalAttempts ? (passCount / totalAttempts) * 100 : 0;

    const questionStats = questionIds.map((questionId) => {
      const correctCount = correctCounts.get(questionId) ?? 0;
      const accuracy = totalAttempts ? (correctCount / totalAttempts) * 100 : 0;
      return {
        questionId,
        correctCount,
        totalAttempts,
        accuracy,
      };
    });

    return {
      totalAttempts,
      averageScore,
      averagePercentage,
      passRate,
      highestScore,
      lowestScore,
      attempts: attempts.map((a) => ({
        attemptId: a.id,
        userId: String(a.userId),
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        score: a.score ?? 0,
        totalScore: a.totalScore ?? 0,
        percentage: a.percentage ?? 0,
      })),
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

    const test = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!test) throw new NotFoundError('Practice test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, test.batchId);
      if (!ok) throw new NotFoundError('Practice test not found');
    }

    const attemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attempts = await attemptRepo.getPracticeTestAnalyticsAttemptsForExport(practiceTestId, attemptStatuses);

    const header = ['attemptId', 'userId', 'userName', 'userEmail', 'status', 'score', 'totalScore', 'percentage', 'startedAt', 'submittedAt'];
    const rows = attempts.map((a) => [
      a.id,
      String(a.userId),
      a.user?.name ?? '',
      a.user?.email ?? '',
      a.status,
      a.score ?? 0,
      a.totalScore ?? 0,
      a.percentage ?? 0,
      a.startedAt?.toISOString?.() ?? '',
      a.submittedAt?.toISOString?.() ?? '',
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

    const test = await examRepo.findExamTestById(businessId, examTestId);
    if (!test) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, test.batchId);
      if (!ok) throw new NotFoundError('Exam test not found');
    }

    const attemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attempts = await attemptRepo.getExamTestAnalyticsAttempts(examTestId, attemptStatuses);
    const totalAttempts = attempts.length;

    const questionIds = await attemptRepo.getExamTestQuestionIds(examTestId);
    const correctCountsRows = await attemptRepo.getExamTestCorrectCountsByQuestion(examTestId, attemptStatuses);
    const correctCounts = new Map(correctCountsRows.map((r) => [r.questionId, r.correctCount]));

    const scores = attempts.map((a) => a.score ?? 0);
    const percentages = attempts.map((a) => a.percentage ?? 0);

    const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
    const averageScore = totalAttempts ? sum(scores) / totalAttempts : 0;
    const averagePercentage = totalAttempts ? sum(percentages) / totalAttempts : 0;
    const highestScore = totalAttempts ? Math.max(...scores) : 0;
    const lowestScore = totalAttempts ? Math.min(...scores) : 0;

    const PASS_THRESHOLD_PERCENT = 50;
    const passCount = attempts.filter((a) => (a.percentage ?? 0) >= PASS_THRESHOLD_PERCENT).length;
    const passRate = totalAttempts ? (passCount / totalAttempts) * 100 : 0;

    const questionStats = questionIds.map((questionId) => {
      const correctCount = correctCounts.get(questionId) ?? 0;
      const accuracy = totalAttempts ? (correctCount / totalAttempts) * 100 : 0;
      return {
        questionId,
        correctCount,
        totalAttempts,
        accuracy,
      };
    });

    return {
      totalAttempts,
      averageScore,
      averagePercentage,
      passRate,
      highestScore,
      lowestScore,
      attempts: attempts.map((a) => ({
        attemptId: a.id,
        userId: String(a.userId),
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        score: a.score ?? 0,
        totalScore: a.totalScore ?? 0,
        percentage: a.percentage ?? 0,
      })),
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

    const test = await examRepo.findExamTestById(businessId, examTestId);
    if (!test) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      const ok = await batchUserRepo.isActiveUserInBatch(user.id, test.batchId);
      if (!ok) throw new NotFoundError('Exam test not found');
    }

    const attemptStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED];
    const attempts = await attemptRepo.getExamTestAnalyticsAttemptsForExport(examTestId, attemptStatuses);

    const header = ['attemptId', 'userId', 'userName', 'userEmail', 'status', 'score', 'totalScore', 'percentage', 'startedAt', 'submittedAt'];
    const rows = attempts.map((a) => [
      a.id,
      String(a.userId),
      a.user?.name ?? '',
      a.user?.email ?? '',
      a.status,
      a.score ?? 0,
      a.totalScore ?? 0,
      a.percentage ?? 0,
      a.startedAt?.toISOString?.() ?? '',
      a.submittedAt?.toISOString?.() ?? '',
    ]);

    return [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  }
}

