import { UserRole } from '@prisma/client';
import { BadRequestError } from '../../../src/errors/api.errors';
import { AttemptStatus, QuestionType, ResultVisibilityExam } from '../../../src/constants/test-enums';
import { TestAttemptService } from '../../../src/services/testAttempt.service';

import * as attemptRepo from '../../../src/repositories/testAttempt.repo';
import * as practiceRepo from '../../../src/repositories/practiceTest.repo';
import * as examRepo from '../../../src/repositories/examTest.repo';
import * as questionRepo from '../../../src/repositories/testQuestion.repo';
import * as batchRepo from '../../../src/repositories/batch.repo';

jest.mock('../../../src/repositories/testAttempt.repo');
jest.mock('../../../src/repositories/practiceTest.repo');
jest.mock('../../../src/repositories/examTest.repo');
jest.mock('../../../src/repositories/test-question.repo');
jest.mock('../../../src/repositories/batch.repo');

describe('Day 4 - Analytics validation & edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exam: throws if started before startAt', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    // Use a large offset to avoid the service's timezone tolerance logic.
    const startAt = new Date(now.getTime() + 24 * 60 * 60_000); // 24h in the future
    const deadlineAt = new Date(now.getTime() + 3_600_000);

    (examRepo.findExamTestById as jest.Mock).mockResolvedValue({
      businessId: 1,
      status: 1,
      startAt,
      deadlineAt,
      durationMinutes: 60,
      resultVisibility: ResultVisibilityExam.AFTER_DEADLINE,
      negativeMarksPerQuestion: 0,
      defaultMarksPerQuestion: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      batchId: 10,
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
    (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const service = new TestAttemptService();
    await expect(
      service.startExamAttempt(1, { id: 7, role: UserRole.STUDENT }, 'exam-test-1'),
    ).rejects.toThrow('Exam has not started yet');
  });

  it('exam: throws if deadline passed', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    const startAt = new Date(now.getTime() - 3_600_000);
    const deadlineAt = new Date(now.getTime() - 1_000);

    (examRepo.findExamTestById as jest.Mock).mockResolvedValue({
      businessId: 1,
      status: 1,
      startAt,
      deadlineAt,
      durationMinutes: 60,
      resultVisibility: ResultVisibilityExam.AFTER_DEADLINE,
      negativeMarksPerQuestion: 0,
      defaultMarksPerQuestion: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      batchId: 10,
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
    (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const service = new TestAttemptService();
    await expect(
      service.startExamAttempt(1, { id: 7, role: UserRole.STUDENT }, 'exam-test-1'),
    ).rejects.toThrow('Exam deadline has passed');
  });

  it('exam: blocks second attempt (single attempt)', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    const startAt = new Date(now.getTime() - 10_000);
    const deadlineAt = new Date(now.getTime() + 3_600_000);

    (examRepo.findExamTestById as jest.Mock).mockResolvedValue({
      businessId: 1,
      status: 1,
      startAt,
      deadlineAt,
      durationMinutes: 60,
      resultVisibility: ResultVisibilityExam.AFTER_DEADLINE,
      negativeMarksPerQuestion: 0,
      defaultMarksPerQuestion: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      batchId: 10,
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
    // completedAttempts.length > 0
    (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValueOnce([
      { id: 'attempt-1', status: AttemptStatus.SUBMITTED },
    ]);

    const service = new TestAttemptService();
    await expect(
      service.startExamAttempt(1, { id: 7, role: UserRole.STUDENT }, 'exam-test-1'),
    ).rejects.toThrow('You have already attempted this exam');
  });

  it('exam: auto-submits when submitted after effectiveEnd', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    const startedAt = new Date(now.getTime() - 2 * 60 * 60_000); // 2h ago
    const durationMinutes = 30; // effectiveEnd = startedAt + 30m = now - 90m

    const deadlineAt = new Date(now.getTime() - 10_000); // reveal=true (AFTER_DEADLINE)

    (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValueOnce({
      id: 'attempt-1',
      examTestId: 'exam-test-1',
      userId: 7,
      status: AttemptStatus.IN_PROGRESS,
      startedAt,
      submittedAt: null,
      examTest: {
        id: 'exam-test-1',
        businessId: 1,
        batchId: 10,
        status: 1,
        startAt: new Date(startedAt.getTime() - 5_000),
        deadlineAt,
        durationMinutes,
        defaultMarksPerQuestion: 1,
        negativeMarksPerQuestion: 1,
        resultVisibility: ResultVisibilityExam.AFTER_DEADLINE,
        shuffleQuestions: false,
        shuffleOptions: false,
      },
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);

    (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([
      {
        id: 'q1',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.TRUE_FALSE,
        text: 'TF?',
        correctTextAnswer: 'true',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
    ]);

    const upsertSpy = attemptRepo.upsertAttemptAnswersAndFinalize as unknown as jest.Mock;
    upsertSpy.mockResolvedValue(undefined);

    const service = new TestAttemptService();
    const result = await service.submitExamAttempt(
      1,
      { id: 7, role: UserRole.STUDENT },
      'attempt-1',
      [
        {
          questionId: 'q1',
          textAnswer: 'false', // incorrect => negative marking
        },
      ],
    );

    const call = upsertSpy.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call.attemptUpdate.status).toBe(AttemptStatus.AUTO_SUBMITTED);
    expect(result.status).toBe(AttemptStatus.AUTO_SUBMITTED);
  });

  it('practice: allows multiple attempts (no single-attempt restriction)', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({
      id: 'practice-test-1',
      businessId: 1,
      batchId: 10,
      status: 1,
      defaultMarksPerQuestion: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
    // No in-progress attempts both times.
    (attemptRepo.findPracticeAttemptsByUser as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    (practiceRepo.findPublishedPracticeTestsForStudent as jest.Mock).mockResolvedValue([]);

    (attemptRepo.createTestAttempt as jest.Mock)
      .mockResolvedValueOnce({
        id: 'attempt-1',
        practiceTestId: 'practice-test-1',
        userId: 7,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: now,
      })
      .mockResolvedValueOnce({
        id: 'attempt-2',
        practiceTestId: 'practice-test-1',
        userId: 7,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: now,
      });

    (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([
      {
        id: 'q1',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.SINGLE_CHOICE,
        text: 'MCQ?',
        correctTextAnswer: null,
        correctOptionIdsAnswers: ['o1'],
        mediaUrl: null,
        explanation: null,
        options: [
          { id: 'o1', questionId: 'q1', text: 'A', mediaUrl: null, createdAt: now, updatedAt: now },
          { id: 'o2', questionId: 'q1', text: 'B', mediaUrl: null, createdAt: now, updatedAt: now },
        ],
      },
    ]);

    const service = new TestAttemptService();
    const r1 = await service.startPracticeAttempt(1, { id: 7, role: UserRole.STUDENT }, 'practice-test-1');
    const r2 = await service.startPracticeAttempt(1, { id: 7, role: UserRole.STUDENT }, 'practice-test-1');
    expect(r1.attemptId).toBe('attempt-1');
    expect(r2.attemptId).toBe('attempt-2');
    expect(attemptRepo.createTestAttempt).toHaveBeenCalledTimes(2);
  });

  it('exam: evaluates all question types + negative marking for exam only', async () => {
    const now = new Date('2026-03-20T10:00:00.000Z');
    jest.setSystemTime(now);

    // Practice attempt evaluation (incorrect gives 0)
    (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValueOnce({
      id: 'attempt-practice-1',
      practiceTestId: 'practice-test-1',
      userId: 7,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
      practiceTest: {
        id: 'practice-test-1',
        businessId: 1,
        batchId: 10,
        status: 1,
        defaultMarksPerQuestion: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
      },
    });

    (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);

    (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([
      // 0=SINGLE_CHOICE
      {
        id: 'q1',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.SINGLE_CHOICE,
        text: 'SC',
        correctTextAnswer: null,
        correctOptionIdsAnswers: ['o1'],
        mediaUrl: null,
        explanation: null,
        options: [{ id: 'o1', questionId: 'q1', text: 'A', mediaUrl: null, createdAt: now, updatedAt: now }],
      },
      // 1=MULTIPLE_CHOICE
      {
        id: 'q2',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'MC',
        correctTextAnswer: null,
        correctOptionIdsAnswers: ['o3', 'o4'],
        mediaUrl: null,
        explanation: null,
        options: [
          { id: 'o3', questionId: 'q2', text: 'A', mediaUrl: null, createdAt: now, updatedAt: now },
          { id: 'o4', questionId: 'q2', text: 'B', mediaUrl: null, createdAt: now, updatedAt: now },
          { id: 'o5', questionId: 'q2', text: 'C', mediaUrl: null, createdAt: now, updatedAt: now },
        ],
      },
      // 2=TRUE_FALSE
      {
        id: 'q3',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.TRUE_FALSE,
        text: 'TF',
        correctTextAnswer: 'true',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
      // 3=NUMERICAL
      {
        id: 'q4',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.NUMERICAL,
        text: 'NUM',
        correctTextAnswer: '10',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
      // 4=FILL_IN_THE_BLANK
      {
        id: 'q5',
        practiceTestId: 'practice-test-1',
        examTestId: null,
        type: QuestionType.FILL_IN_THE_BLANK,
        text: 'FIB',
        correctTextAnswer: 'Hello',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
    ]);

    const upsertSpyPractice = attemptRepo.upsertAttemptAnswersAndFinalize as unknown as jest.Mock;
    upsertSpyPractice.mockResolvedValue(undefined);

    const service = new TestAttemptService();
    await service.submitPracticeAttempt(
      1,
      { id: 7, role: UserRole.STUDENT },
      'attempt-practice-1',
      [
        { questionId: 'q1', selectedOptionIds: ['o1'] }, // correct
        { questionId: 'q2', selectedOptionIds: ['o3', 'o4'] }, // correct
        { questionId: 'q3', textAnswer: 'TRUE' }, // correct (case-insensitive)
        { questionId: 'q4', textAnswer: '10' }, // correct numeric
        { questionId: 'q5', textAnswer: 'wrong' }, // incorrect => 0
      ],
    );

    const practiceCall = upsertSpyPractice.mock.calls[0]?.[0];
    const practiceQ5 = practiceCall.evaluated.find((e: any) => e.questionId === 'q5');
    expect(practiceQ5.obtainedMarks).toBe(0);

    // Exam attempt evaluation (incorrect => negative)
    (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValueOnce({
      id: 'attempt-exam-1',
      examTestId: 'exam-test-1',
      userId: 7,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: now,
      examTest: {
        id: 'exam-test-1',
        businessId: 1,
        batchId: 10,
        status: 1,
        startAt: now,
        deadlineAt: now,
        durationMinutes: 60,
        defaultMarksPerQuestion: 1,
        negativeMarksPerQuestion: 2,
        resultVisibility: ResultVisibilityExam.AFTER_DEADLINE,
        shuffleQuestions: false,
        shuffleOptions: false,
      },
    });

    (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([
      {
        id: 'q1',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.SINGLE_CHOICE,
        text: 'SC',
        correctTextAnswer: null,
        correctOptionIdsAnswers: ['o1'],
        mediaUrl: null,
        explanation: null,
        options: [{ id: 'o1', questionId: 'q1', text: 'A', mediaUrl: null, createdAt: now, updatedAt: now }],
      },
      {
        id: 'q2',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.MULTIPLE_CHOICE,
        text: 'MC',
        correctTextAnswer: null,
        correctOptionIdsAnswers: ['o3', 'o4'],
        mediaUrl: null,
        explanation: null,
        options: [
          { id: 'o3', questionId: 'q2', text: 'A', mediaUrl: null, createdAt: now, updatedAt: now },
          { id: 'o4', questionId: 'q2', text: 'B', mediaUrl: null, createdAt: now, updatedAt: now },
          { id: 'o5', questionId: 'q2', text: 'C', mediaUrl: null, createdAt: now, updatedAt: now },
        ],
      },
      {
        id: 'q3',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.TRUE_FALSE,
        text: 'TF',
        correctTextAnswer: 'true',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
      {
        id: 'q4',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.NUMERICAL,
        text: 'NUM',
        correctTextAnswer: '10',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
      {
        id: 'q5',
        practiceTestId: null,
        examTestId: 'exam-test-1',
        type: QuestionType.FILL_IN_THE_BLANK,
        text: 'FIB',
        correctTextAnswer: 'Hello',
        correctOptionIdsAnswers: [],
        mediaUrl: null,
        explanation: null,
        options: [],
      },
    ]);

    const upsertCallCountBefore = upsertSpyPractice.mock.calls.length;
    await service.submitExamAttempt(
      1,
      { id: 7, role: UserRole.STUDENT },
      'attempt-exam-1',
      [
        { questionId: 'q1', selectedOptionIds: ['o1'] }, // correct
        { questionId: 'q2', selectedOptionIds: ['o3', 'o4'] }, // correct
        { questionId: 'q3', textAnswer: 'TRUE' }, // correct
        { questionId: 'q4', textAnswer: '10' }, // correct
        { questionId: 'q5', textAnswer: 'wrong' }, // incorrect => -2
      ],
    );

    expect(upsertSpyPractice.mock.calls.length).toBeGreaterThan(upsertCallCountBefore);
    const examCall = upsertSpyPractice.mock.calls[upsertSpyPractice.mock.calls.length - 1]?.[0];
    const examQ5 = examCall.evaluated.find((e: any) => e.questionId === 'q5');
    expect(examQ5.obtainedMarks).toBe(-2);
  });
});

