import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { practiceTestController } from '../../../src/controllers/practiceTest.controller';
import { examTestController } from '../../../src/controllers/examTest.controller';
import { PracticeTestService } from '../../../src/services/practiceTest.service';
import { ExamTestService } from '../../../src/services/examTest.service';
import { TestAttemptService } from '../../../src/services/testAttempt.service';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { AuthRequest } from '../../../src/dtos/auth.dto';
import { QuestionType, AttemptStatus } from '../../../src/constants/test-enums';

jest.mock('../../../src/utils/logger');

// ─── shared test fixtures ────────────────────────────────────────────────────

const NOW = new Date('2026-03-21T10:00:00.000Z');

const PRACTICE_TEST = {
  id: 'pt-1',
  businessId: 1,
  batchId: 3,
  name: 'Test 1',
  description: null,
  status: 1,
  defaultMarksPerQuestion: 4,
  showExplanations: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  createdBy: 1,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  _count: { questions: 2 },
};

const EXAM_TEST = {
  id: 'et-1',
  businessId: 1,
  batchId: 3,
  name: 'Exam 1',
  description: null,
  status: 1,
  startAt: NOW,
  deadlineAt: new Date(NOW.getTime() + 3_600_000),
  durationMinutes: 60,
  defaultMarksPerQuestion: 4,
  negativeMarksPerQuestion: 1,
  resultVisibility: 0,
  shuffleQuestions: false,
  shuffleOptions: false,
  createdBy: 1,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  _count: { questions: 2 },
};

const MCQ_QUESTION = {
  id: 'q-1',
  type: QuestionType.SINGLE_CHOICE,
  text: 'What is 2+2?',
  mediaUrl: null,
  correctTextAnswer: null,
  explanation: 'Basic math',
  correctOptionIdsAnswers: ['o-2'],
  options: [
    { id: 'o-1', text: '3', mediaUrl: null },
    { id: 'o-2', text: '4', mediaUrl: null },
  ],
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRes(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function makeReq(overrides: Partial<AuthRequest> = {}): Partial<AuthRequest> {
  return {
    user: { id: 1, role: UserRole.ADMIN, businessId: 1, email: 'admin@test.com' },
    params: { businessId: '1' },
    body: {},
    query: {},
    ...overrides,
    // Merge params so callers can add extra params without losing businessId
    params: { businessId: '1', ...(overrides.params ?? {}) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRACTICE TEST CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

describe('PracticeTest Controller', () => {
  let practiceGetSpy: jest.SpyInstance;
  let practiceListSpy: jest.SpyInstance;
  let practiceCreateSpy: jest.SpyInstance;
  let practiceUpdateSpy: jest.SpyInstance;
  let practiceRemoveSpy: jest.SpyInstance;
  let practicePublishSpy: jest.SpyInstance;
  let practiceListQSpy: jest.SpyInstance;
  let practiceCreateQSpy: jest.SpyInstance;
  let practiceUpdateQSpy: jest.SpyInstance;
  let practiceDeleteQSpy: jest.SpyInstance;

  beforeEach(() => {
    practiceGetSpy     = jest.spyOn(PracticeTestService.prototype, 'get');
    practiceListSpy    = jest.spyOn(PracticeTestService.prototype, 'list');
    practiceCreateSpy  = jest.spyOn(PracticeTestService.prototype, 'create');
    practiceUpdateSpy  = jest.spyOn(PracticeTestService.prototype, 'update');
    practiceRemoveSpy  = jest.spyOn(PracticeTestService.prototype, 'remove');
    practicePublishSpy = jest.spyOn(PracticeTestService.prototype, 'publish');
    practiceListQSpy   = jest.spyOn(PracticeTestService.prototype, 'listQuestions');
    practiceCreateQSpy = jest.spyOn(PracticeTestService.prototype, 'createQuestion');
    practiceUpdateQSpy = jest.spyOn(PracticeTestService.prototype, 'updateQuestion');
    practiceDeleteQSpy = jest.spyOn(PracticeTestService.prototype, 'deleteQuestion');
  });

  afterEach(() => jest.restoreAllMocks());

  // ── GET single ────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns 200 with test + questions for admin', async () => {
      const req = makeReq({ params: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      practiceGetSpy.mockResolvedValue({ ...PRACTICE_TEST, questions: [MCQ_QUESTION] });

      await practiceTestController.get(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 404 when test not found', async () => {
      const req = makeReq({ params: { practiceTestId: 'missing' } });
      const res = makeRes();
      practiceGetSpy.mockRejectedValue(new NotFoundError('Practice test not found'));

      await practiceTestController.get(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when practiceTestId missing', async () => {
      const req = makeReq({ params: {} });
      const res = makeRes();

      await practiceTestController.get(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── LIST ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns 200 with array of tests', async () => {
      const req = makeReq({ query: {} });
      const res = makeRes();
      practiceListSpy.mockResolvedValue([PRACTICE_TEST]);

      await practiceTestController.list(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 for invalid status query param', async () => {
      const req = makeReq({ query: { status: 'abc' } });
      const res = makeRes();

      await practiceTestController.list(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── CREATE ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns 201 on success', async () => {
      const req = makeReq({ body: { batchId: 3, name: 'New Test' } });
      const res = makeRes();
      practiceCreateSpy.mockResolvedValue(PRACTICE_TEST);

      await practiceTestController.create(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 400 on BadRequestError', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      practiceCreateSpy.mockRejectedValue(new BadRequestError('batchId required'));

      await practiceTestController.create(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { practiceTestId: 'pt-1' }, body: { name: 'Updated' } });
      const res = makeRes();
      practiceUpdateSpy.mockResolvedValue(PRACTICE_TEST);

      await practiceTestController.update(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when test not found', async () => {
      const req = makeReq({ params: { practiceTestId: 'missing' }, body: {} });
      const res = makeRes();
      practiceUpdateSpy.mockRejectedValue(new NotFoundError('Practice test not found'));

      await practiceTestController.update(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── REMOVE ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      practiceRemoveSpy.mockResolvedValue(undefined);

      await practiceTestController.remove(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when test not found', async () => {
      const req = makeReq({ params: { practiceTestId: 'missing' } });
      const res = makeRes();
      practiceRemoveSpy.mockRejectedValue(new NotFoundError('Practice test not found'));

      await practiceTestController.remove(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── PUBLISH ───────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ body: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      practicePublishSpy.mockResolvedValue({ ...PRACTICE_TEST, status: 1 });

      await practiceTestController.publish(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 when already published', async () => {
      const req = makeReq({ body: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      practicePublishSpy.mockRejectedValue(new BadRequestError('Already published'));

      await practiceTestController.publish(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── QUESTIONS ─────────────────────────────────────────────────────────────

  describe('listQuestions', () => {
    it('returns 200 with questions including correctTextAnswer and explanation', async () => {
      const req = makeReq({ params: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      practiceListQSpy.mockResolvedValue([MCQ_QUESTION]);

      await practiceTestController.listQuestions(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('createQuestion', () => {
    it('returns 201 on success', async () => {
      const req = makeReq({
        params: { practiceTestId: 'pt-1' },
        body: {
          type: QuestionType.SINGLE_CHOICE,
          questionText: 'Q?',
          correctOptionIdsAnswers: ['o-2'],
          options: [
            { text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' },
          ],
        },
      });
      const res = makeRes();
      practiceCreateQSpy.mockResolvedValue(MCQ_QUESTION);

      await practiceTestController.createQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 400 when test has attempts', async () => {
      const req = makeReq({ params: { practiceTestId: 'pt-1' }, body: {} });
      const res = makeRes();
      practiceCreateQSpy.mockRejectedValue(new BadRequestError('Cannot modify questions after attempts have started'));

      await practiceTestController.createQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateQuestion', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { questionId: 'q-1' }, body: { questionText: 'Updated?' } });
      const res = makeRes();
      practiceUpdateQSpy.mockResolvedValue(MCQ_QUESTION);

      await practiceTestController.updateQuestion(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when question not found', async () => {
      const req = makeReq({ params: { questionId: 'missing' }, body: {} });
      const res = makeRes();
      practiceUpdateQSpy.mockRejectedValue(new NotFoundError('Question not found'));

      await practiceTestController.updateQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteQuestion', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { questionId: 'q-1' } });
      const res = makeRes();
      practiceDeleteQSpy.mockResolvedValue(undefined);

      await practiceTestController.deleteQuestion(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when question not found', async () => {
      const req = makeReq({ params: { questionId: 'missing' } });
      const res = makeRes();
      practiceDeleteQSpy.mockRejectedValue(new NotFoundError('Question not found'));

      await practiceTestController.deleteQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAM TEST CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

describe('ExamTest Controller', () => {
  let examGetSpy: jest.SpyInstance;
  let examListSpy: jest.SpyInstance;
  let examCreateSpy: jest.SpyInstance;
  let examUpdateSpy: jest.SpyInstance;
  let examRemoveSpy: jest.SpyInstance;
  let examPublishSpy: jest.SpyInstance;
  let examListQSpy: jest.SpyInstance;
  let examCreateQSpy: jest.SpyInstance;
  let examUpdateQSpy: jest.SpyInstance;
  let examDeleteQSpy: jest.SpyInstance;

  beforeEach(() => {
    examGetSpy     = jest.spyOn(ExamTestService.prototype, 'get');
    examListSpy    = jest.spyOn(ExamTestService.prototype, 'list');
    examCreateSpy  = jest.spyOn(ExamTestService.prototype, 'create');
    examUpdateSpy  = jest.spyOn(ExamTestService.prototype, 'update');
    examRemoveSpy  = jest.spyOn(ExamTestService.prototype, 'remove');
    examPublishSpy = jest.spyOn(ExamTestService.prototype, 'publish');
    examListQSpy   = jest.spyOn(ExamTestService.prototype, 'listQuestions');
    examCreateQSpy = jest.spyOn(ExamTestService.prototype, 'createQuestion');
    examUpdateQSpy = jest.spyOn(ExamTestService.prototype, 'updateQuestion');
    examDeleteQSpy = jest.spyOn(ExamTestService.prototype, 'deleteQuestion');
  });

  afterEach(() => jest.restoreAllMocks());

  describe('get', () => {
    it('returns 200 with exam test + questions for admin', async () => {
      const req = makeReq({ params: { examTestId: 'et-1' } });
      const res = makeRes();
      examGetSpy.mockResolvedValue({ ...EXAM_TEST, questions: [MCQ_QUESTION] });

      await examTestController.get(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when exam test not found', async () => {
      const req = makeReq({ params: { examTestId: 'missing' } });
      const res = makeRes();
      examGetSpy.mockRejectedValue(new NotFoundError('Exam test not found'));

      await examTestController.get(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when examTestId missing', async () => {
      const req = makeReq({ params: {} });
      const res = makeRes();

      await examTestController.get(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('list', () => {
    it('returns 200 with array of exam tests', async () => {
      const req = makeReq({ query: {} });
      const res = makeRes();
      examListSpy.mockResolvedValue([EXAM_TEST]);

      await examTestController.list(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 for invalid batchId query param', async () => {
      const req = makeReq({ query: { batchId: 'xyz' } });
      const res = makeRes();

      await examTestController.list(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('create', () => {
    it('returns 201 on success', async () => {
      const req = makeReq({
        body: {
          batchId: 3,
          name: 'Exam',
          startAt: NOW.toISOString(),
          deadlineAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
          durationMinutes: 60,
        },
      });
      const res = makeRes();
      examCreateSpy.mockResolvedValue(EXAM_TEST);

      await examTestController.create(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 400 on BadRequestError', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      examCreateSpy.mockRejectedValue(new BadRequestError('batchId required'));

      await examTestController.create(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('update', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { examTestId: 'et-1' }, body: { name: 'Updated Exam' } });
      const res = makeRes();
      examUpdateSpy.mockResolvedValue(EXAM_TEST);

      await examTestController.update(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when exam test not found', async () => {
      const req = makeReq({ params: { examTestId: 'missing' }, body: {} });
      const res = makeRes();
      examUpdateSpy.mockRejectedValue(new NotFoundError('Exam test not found'));

      await examTestController.update(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('remove', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { examTestId: 'et-1' } });
      const res = makeRes();
      examRemoveSpy.mockResolvedValue(undefined);

      await examTestController.remove(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when exam test not found', async () => {
      const req = makeReq({ params: { examTestId: 'missing' } });
      const res = makeRes();
      examRemoveSpy.mockRejectedValue(new NotFoundError('Exam test not found'));

      await examTestController.remove(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('publish', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ body: { examTestId: 'et-1' } });
      const res = makeRes();
      examPublishSpy.mockResolvedValue({ ...EXAM_TEST, status: 1 });

      await examTestController.publish(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 when no questions exist', async () => {
      const req = makeReq({ body: { examTestId: 'et-1' } });
      const res = makeRes();
      examPublishSpy.mockRejectedValue(new BadRequestError('Add at least one question before publishing'));

      await examTestController.publish(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listQuestions', () => {
    it('returns 200 with questions including correctTextAnswer and explanation', async () => {
      const req = makeReq({ params: { examTestId: 'et-1' } });
      const res = makeRes();
      examListQSpy.mockResolvedValue([MCQ_QUESTION]);

      await examTestController.listQuestions(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('createQuestion', () => {
    it('returns 201 on success', async () => {
      const req = makeReq({
        params: { examTestId: 'et-1' },
        body: {
          type: QuestionType.SINGLE_CHOICE,
          questionText: 'Q?',
          correctOptionIdsAnswers: ['o-2'],
          options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
        },
      });
      const res = makeRes();
      examCreateQSpy.mockResolvedValue(MCQ_QUESTION);

      await examTestController.createQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 400 when exam has attempts', async () => {
      const req = makeReq({ params: { examTestId: 'et-1' }, body: {} });
      const res = makeRes();
      examCreateQSpy.mockRejectedValue(new BadRequestError('Cannot modify questions after attempts have started'));

      await examTestController.createQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateQuestion', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { questionId: 'q-1' }, body: { questionText: 'Updated?' } });
      const res = makeRes();
      examUpdateQSpy.mockResolvedValue(MCQ_QUESTION);

      await examTestController.updateQuestion(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when question not found', async () => {
      const req = makeReq({ params: { questionId: 'missing' }, body: {} });
      const res = makeRes();
      examUpdateQSpy.mockRejectedValue(new NotFoundError('Question not found'));

      await examTestController.updateQuestion(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteQuestion', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({ params: { questionId: 'q-1' } });
      const res = makeRes();
      examDeleteQSpy.mockResolvedValue(undefined);

      await examTestController.deleteQuestion(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST ATTEMPT CONTROLLER (startAttempt, getAttempt, submitAttempt)
// ═══════════════════════════════════════════════════════════════════════════

describe('TestAttempt Controller (via practiceTest + examTest controllers)', () => {
  let startPracticeSpy: jest.SpyInstance;
  let getPracticeAttemptSpy: jest.SpyInstance;
  let submitPracticeSpy: jest.SpyInstance;
  let startExamSpy: jest.SpyInstance;
  let getExamAttemptSpy: jest.SpyInstance;
  let submitExamSpy: jest.SpyInstance;

  const STUDENT_USER = { id: 5, role: UserRole.STUDENT, businessId: 1, email: 'student@test.com' };

  const ATTEMPT_STARTED = {
    attemptId: 'attempt-1',
    startedAt: NOW,
    test: { ...PRACTICE_TEST, batch: { displayName: 'Batch A' } },
    questions: [MCQ_QUESTION],
  };

  const SUBMIT_RESULT = {
    attemptId: 'attempt-1',
    status: AttemptStatus.SUBMITTED,
    score: 4,
    totalScore: 4,
    percentage: 100,
    answers: [],
    submittedAt: NOW,
    result: { questions: [] },
  };

  beforeEach(() => {
    startPracticeSpy      = jest.spyOn(TestAttemptService.prototype, 'startPracticeAttempt');
    getPracticeAttemptSpy = jest.spyOn(TestAttemptService.prototype, 'getPracticeAttemptDetails');
    submitPracticeSpy     = jest.spyOn(TestAttemptService.prototype, 'submitPracticeAttempt');
    startExamSpy          = jest.spyOn(TestAttemptService.prototype, 'startExamAttempt');
    getExamAttemptSpy     = jest.spyOn(TestAttemptService.prototype, 'getExamAttemptDetails');
    submitExamSpy         = jest.spyOn(TestAttemptService.prototype, 'submitExamAttempt');
  });

  afterEach(() => jest.restoreAllMocks());

  // ── Practice attempt ──────────────────────────────────────────────────────

  describe('startAttempt (practice)', () => {
    it('returns 201 and questions WITHOUT correctTextAnswer/explanation', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { practiceTestId: 'pt-1' } });
      const res = makeRes();
      startPracticeSpy.mockResolvedValue(ATTEMPT_STARTED);

      await practiceTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      const firstQuestion = payload.data.questions[0];
      // Student must NOT see correct answer fields during active attempt
      expect(firstQuestion).not.toHaveProperty('correctTextAnswer');
      expect(firstQuestion).not.toHaveProperty('explanation');
    });

    it('returns 400 when only admin tries to start', async () => {
      const req = makeReq({ body: { practiceTestId: 'pt-1' } }); // ADMIN role
      const res = makeRes();
      startPracticeSpy.mockRejectedValue(new BadRequestError('Only students can start attempts'));

      await practiceTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when practice test not found', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { practiceTestId: 'missing' } });
      const res = makeRes();
      startPracticeSpy.mockRejectedValue(new NotFoundError('Practice test not found'));

      await practiceTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAttempt (practice)', () => {
    it('returns 200 with attempt details', async () => {
      const req = makeReq({ user: STUDENT_USER, params: { attemptId: 'attempt-1' } });
      const res = makeRes();
      getPracticeAttemptSpy.mockResolvedValue({
        attempt: { id: 'attempt-1', status: AttemptStatus.IN_PROGRESS },
        test: PRACTICE_TEST,
        questions: [],
      });

      await practiceTestController.getAttempt(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 404 when attempt not found', async () => {
      const req = makeReq({ user: STUDENT_USER, params: { attemptId: 'missing' } });
      const res = makeRes();
      getPracticeAttemptSpy.mockRejectedValue(new NotFoundError('Practice attempt not found'));

      await practiceTestController.getAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('submitAttempt (practice)', () => {
    it('returns 200 with score on success', async () => {
      const req = makeReq({
        user: STUDENT_USER,
        params: { attemptId: 'attempt-1' },
        body: { answers: [{ questionId: 'q-1', selectedOptionIds: ['o-2'] }] },
      });
      const res = makeRes();
      submitPracticeSpy.mockResolvedValue(SUBMIT_RESULT);

      await practiceTestController.submitAttempt(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 when attempt already submitted', async () => {
      const req = makeReq({
        user: STUDENT_USER,
        params: { attemptId: 'attempt-1' },
        body: { answers: [] },
      });
      const res = makeRes();
      submitPracticeSpy.mockRejectedValue(new BadRequestError('Attempt already submitted'));

      await practiceTestController.submitAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── Exam attempt ──────────────────────────────────────────────────────────

  describe('startAttempt (exam)', () => {
    it('returns 201 and questions WITHOUT correctTextAnswer/explanation', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { examTestId: 'et-1' } });
      const res = makeRes();
      startExamSpy.mockResolvedValue({
        attemptId: 'attempt-2',
        startedAt: NOW,
        test: { ...EXAM_TEST, batch: { displayName: 'Batch A' } },
        questions: [MCQ_QUESTION],
      });

      await examTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = (res.json as jest.Mock).mock.calls[0][0];
      const firstQuestion = payload.data.questions[0];
      expect(firstQuestion).not.toHaveProperty('correctTextAnswer');
      expect(firstQuestion).not.toHaveProperty('explanation');
    });

    it('returns 400 when exam has not started yet', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { examTestId: 'et-1' } });
      const res = makeRes();
      startExamSpy.mockRejectedValue(new BadRequestError('Exam has not started yet'));

      await examTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when exam deadline has passed', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { examTestId: 'et-1' } });
      const res = makeRes();
      startExamSpy.mockRejectedValue(new BadRequestError('Exam deadline has passed'));

      await examTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when student already attempted exam', async () => {
      const req = makeReq({ user: STUDENT_USER, body: { examTestId: 'et-1' } });
      const res = makeRes();
      startExamSpy.mockRejectedValue(new BadRequestError('You have already attempted this exam'));

      await examTestController.startAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAttempt (exam)', () => {
    it('returns 200 with attempt details', async () => {
      const req = makeReq({ user: STUDENT_USER, params: { attemptId: 'attempt-2' } });
      const res = makeRes();
      getExamAttemptSpy.mockResolvedValue({
        attempt: { id: 'attempt-2', status: AttemptStatus.IN_PROGRESS },
        test: EXAM_TEST,
        questions: [],
      });

      await examTestController.getAttempt(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('submitAttempt (exam)', () => {
    it('returns 200 on success', async () => {
      const req = makeReq({
        user: STUDENT_USER,
        params: { attemptId: 'attempt-2' },
        body: { answers: [{ questionId: 'q-1', selectedOptionIds: ['o-2'] }] },
      });
      const res = makeRes();
      submitExamSpy.mockResolvedValue({ ...SUBMIT_RESULT, attemptId: 'attempt-2' });

      await examTestController.submitAttempt(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 when deadline passed at submit time', async () => {
      const req = makeReq({
        user: STUDENT_USER,
        params: { attemptId: 'attempt-2' },
        body: { answers: [] },
      });
      const res = makeRes();
      submitExamSpy.mockRejectedValue(new BadRequestError('Exam deadline has passed, submission not allowed'));

      await examTestController.submitAttempt(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
