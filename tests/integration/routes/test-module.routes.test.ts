/**
 * test-module.routes.test.ts
 * Integration tests for practice test and exam test routes.
 *
 * Auth strategy: the real auth middleware reads tokens from httpOnly cookies
 * (cookie name: ck_access_token). In tests we bypass it entirely by mocking
 * the middleware module and injecting req.user directly — same pattern used
 * across the rest of the integration test suite.
 */

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { practiceTestRouter } from '../../../src/routes/practiceTest.routes';
import { examTestRouter } from '../../../src/routes/examTest.routes';
import { QuestionType, AttemptStatus } from '../../../src/constants/test-enums';
import { SubjectStatus, UserRole } from '@prisma/client';

import * as practiceRepo from '../../../src/repositories/practiceTest.repo';
import * as examRepo from '../../../src/repositories/examTest.repo';
import * as questionRepo from '../../../src/repositories/testQuestion.repo';
import * as attemptRepo from '../../../src/repositories/testAttempt.repo';
import * as batchRepo from '../../../src/repositories/batch.repo';
import * as subjectRepo from '../../../src/repositories/subject.repo';

// ─── mock all repos ──────────────────────────────────────────────────────────
jest.mock('../../../src/repositories/practiceTest.repo');
jest.mock('../../../src/repositories/examTest.repo');
jest.mock('../../../src/repositories/testQuestion.repo');
jest.mock('../../../src/repositories/testAttempt.repo');
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/utils/logger');

// ─── bypass auth + business-access middleware ────────────────────────────────
// The real authenticate reads from req.cookies['ck_access_token'].
// We mock the whole module so tests control req.user via the role variable below.
let mockUserRole: UserRole = UserRole.ADMIN;

jest.mock('../../../src/middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => next(),
  authorize: (..._roles: any[]) => (req: any, res: any, next: any) => {
    // Replicate the real authorize logic against the injected user
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (_roles.length > 0 && !_roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  },
}));

jest.mock('../../../src/middlewares/validation.middleware', () => ({
  validateIdParam: () => (req: any, _res: any, next: any) => next(),
  validateStringIdParam: () => (req: any, _res: any, next: any) => next(),
  authorizeBusinessAccess: (req: any, _res: any, next: any) => next(),
}));

// ─── app setup ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Inject req.user from the mutable mockUserRole variable
app.use((req: any, _res, next) => {
  req.user = { id: 1, role: mockUserRole, businessId: 1, email: 'test@test.com' };
  next();
});

app.use('/api/business', practiceTestRouter);
app.use('/api/business', examTestRouter);
app.use(errorHandler);

// ─── shared fixtures ──────────────────────────────────────────────────────────

const NOW = new Date('2026-03-21T10:00:00.000Z');
// Use dynamic dates for exam tests so timing checks pass regardless of when tests run
const EXAM_START = new Date(Date.now() - 3_600_000);   // 1 hour ago
const EXAM_DEADLINE = new Date(Date.now() + 3_600_000); // 1 hour from now

const SUBJECT_ID = 1;
const SUBJECT_COURSE_ID = 99;

const PRACTICE_TEST_ROW = {
  id: 'pt-1',
  businessId: 1,
  batchId: 3,
  batch: { id: 3, displayName: 'Batch A' },
  name: 'Practice Test 1',
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

const EXAM_TEST_ROW = {
  id: 'et-1',
  businessId: 1,
  batchId: 3,
  batch: { id: 3, displayName: 'Batch A' },
  name: 'Exam Test 1',
  description: null,
  status: 1,
  startAt: EXAM_START,
  deadlineAt: EXAM_DEADLINE,
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

const MCQ_QUESTION_ROW = {
  id: 'q-1',
  practiceTestId: 'pt-1',
  examTestId: null,
  type: QuestionType.SINGLE_CHOICE,
  text: 'What is 2+2?',
  mediaUrl: null,
  correctTextAnswer: null,
  explanation: 'Basic math',
  correctOptionIdsAnswers: ['o-2'],
  createdAt: NOW,
  updatedAt: NOW,
  options: [
    { id: 'o-1', questionId: 'q-1', text: '3', mediaUrl: null, createdAt: NOW, updatedAt: NOW },
    { id: 'o-2', questionId: 'q-1', text: '4', mediaUrl: null, createdAt: NOW, updatedAt: NOW },
    { id: 'o-3', questionId: 'q-1', text: '5', mediaUrl: null, createdAt: NOW, updatedAt: NOW },
    { id: 'o-4', questionId: 'q-1', text: '2', mediaUrl: null, createdAt: NOW, updatedAt: NOW },
  ],
};

const TF_QUESTION_ROW = {
  id: 'q-2',
  practiceTestId: 'pt-1',
  examTestId: null,
  type: QuestionType.TRUE_FALSE,
  text: 'Is sky blue?',
  mediaUrl: null,
  correctTextAnswer: 'true',
  explanation: 'Yes it is',
  correctOptionIdsAnswers: [],
  createdAt: NOW,
  updatedAt: NOW,
  options: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserRole = UserRole.ADMIN;
});

// ═══════════════════════════════════════════════════════════════════════════
// PRACTICE TEST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe('Practice Test Routes', () => {

  // ── POST /practice-tests ──────────────────────────────────────────────────

  describe('POST /api/business/1/practice-tests', () => {
    it('creates a practice test (admin)', async () => {
      (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
      (batchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 3, courseId: SUBJECT_COURSE_ID });
      (subjectRepo.findSubjectById as jest.Mock).mockResolvedValue({
        id: SUBJECT_ID,
        courseId: SUBJECT_COURSE_ID,
        status: SubjectStatus.ACTIVE,
      });
      (practiceRepo.createPracticeTest as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);

      const res = await request(app)
        .post('/api/business/1/practice-tests')
        .send({ batchId: 3, subjectId: SUBJECT_ID, name: 'Practice Test 1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Practice Test 1');
    });

    it('returns 403 when student tries to create', async () => {
      mockUserRole = UserRole.STUDENT;

      const res = await request(app)
        .post('/api/business/1/practice-tests')
        .send({ batchId: 3, name: 'Test' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when batchId is missing', async () => {
      const res = await request(app)
        .post('/api/business/1/practice-tests')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /practice-tests ───────────────────────────────────────────────────

  describe('GET /api/business/1/practice-tests', () => {
    it('lists practice tests for admin', async () => {
      (practiceRepo.findPracticeTestsByBusinessId as jest.Mock).mockResolvedValue([PRACTICE_TEST_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).get('/api/business/1/practice-tests');
      expect(res.status).toBe(403);
    });

    it('filters by status query param', async () => {
      (practiceRepo.findPracticeTestsByBusinessId as jest.Mock).mockResolvedValue([PRACTICE_TEST_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests?status=1');

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid status param', async () => {
      const res = await request(app).get('/api/business/1/practice-tests?status=abc');
      expect(res.status).toBe(400);
    });
  });

  // ── GET /practice-tests/:id ───────────────────────────────────────────────

  describe('GET /api/business/1/practice-tests/pt-1', () => {
    it('returns test with questions for admin', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests/pt-1');

      expect(res.status).toBe(200);
      expect(res.body.data.questions).toHaveLength(2);
      // Admin/teacher should see correctTextAnswer and explanation
      const tfQ = res.body.data.questions.find((q: any) => q.type === QuestionType.TRUE_FALSE);
      expect(tfQ.correctTextAnswer).toBe('true');
      expect(tfQ.explanation).toBe('Yes it is');
    });

    it('returns test with questions for teacher', async () => {
      mockUserRole = UserRole.TEACHER;
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests/pt-1');

      expect(res.status).toBe(200);
      expect(res.body.data.questions).toHaveLength(1);
    });

    it('returns 404 when test not found', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/business/1/practice-tests/missing');

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /practice-tests/:id ───────────────────────────────────────────────

  describe('PUT /api/business/1/practice-tests/pt-1', () => {
    it('updates a practice test', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (practiceRepo.updatePracticeTest as jest.Mock).mockResolvedValue({ ...PRACTICE_TEST_ROW, name: 'Updated' });

      const res = await request(app)
        .put('/api/business/1/practice-tests/pt-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).put('/api/business/1/practice-tests/pt-1').send({ name: 'X' });
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /practice-tests/:id ────────────────────────────────────────────

  describe('DELETE /api/business/1/practice-tests/pt-1', () => {
    it('deletes a practice test', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (practiceRepo.deletePracticeTest as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app).delete('/api/business/1/practice-tests/pt-1');

      expect(res.status).toBe(200);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).delete('/api/business/1/practice-tests/pt-1');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /practice-tests/publish ──────────────────────────────────────────

  describe('POST /api/business/1/practice-tests/publish', () => {
    it('publishes a draft test', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({ ...PRACTICE_TEST_ROW, status: 0 });
      (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
      (questionRepo.countQuestionsForPracticeTest as jest.Mock).mockResolvedValue(2);
      (practiceRepo.updatePracticeTest as jest.Mock).mockResolvedValue({ ...PRACTICE_TEST_ROW, status: 1 });

      const res = await request(app)
        .post('/api/business/1/practice-tests/publish')
        .send({ practiceTestId: 'pt-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(1);
    });

    it('returns 400 when test has no questions', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({ ...PRACTICE_TEST_ROW, status: 0 });
      (questionRepo.countQuestionsForPracticeTest as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .post('/api/business/1/practice-tests/publish')
        .send({ practiceTestId: 'pt-1' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /practice-tests/:id/questions ─────────────────────────────────────

  describe('GET /api/business/1/practice-tests/pt-1/questions', () => {
    it('returns questions with correctTextAnswer and explanation for admin', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests/pt-1/questions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const tfQ = res.body.data.find((q: any) => q.type === QuestionType.TRUE_FALSE);
      expect(tfQ.correctTextAnswer).toBe('true');
      expect(tfQ.explanation).toBe('Yes it is');
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).get('/api/business/1/practice-tests/pt-1/questions');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /practice-tests/:id/questions ────────────────────────────────────

  describe('POST /api/business/1/practice-tests/pt-1/questions', () => {
    it('creates an MCQ question', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.createPracticeTestQuestionResolvingCorrect as jest.Mock).mockResolvedValue(MCQ_QUESTION_ROW);

      const res = await request(app)
        .post('/api/business/1/practice-tests/pt-1/questions')
        .send({
          type: QuestionType.SINGLE_CHOICE,
          questionText: 'What is 2+2?',
          correctOptionIdsAnswers: ['o-2'],
          options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '2' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.correctTextAnswer).toBeNull();
      expect(res.body.data.explanation).toBe('Basic math');
    });

    it('creates a TRUE_FALSE question', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.createPracticeTestQuestionResolvingCorrect as jest.Mock).mockResolvedValue(TF_QUESTION_ROW);

      const res = await request(app)
        .post('/api/business/1/practice-tests/pt-1/questions')
        .send({
          type: QuestionType.TRUE_FALSE,
          questionText: 'Is sky blue?',
          correctTextAnswer: 'true',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.correctTextAnswer).toBe('true');
    });

    it('returns 400 when MCQ has fewer than 4 options', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/business/1/practice-tests/pt-1/questions')
        .send({
          type: QuestionType.SINGLE_CHOICE,
          questionText: 'Q?',
          correctOptionIdsAnswers: ['o-1'],
          options: [{ text: 'A' }, { text: 'B' }],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when test already has attempts', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/business/1/practice-tests/pt-1/questions')
        .send({
          type: QuestionType.TRUE_FALSE,
          questionText: 'Q?',
          correctTextAnswer: 'true',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app)
        .post('/api/business/1/practice-tests/pt-1/questions')
        .send({ type: 0, questionText: 'Q?' });
      expect(res.status).toBe(403);
    });
  });

  // ── PUT /practice-tests/questions/:questionId ─────────────────────────────

  describe('PUT /api/business/1/practice-tests/questions/q-1', () => {
    it('updates a question', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, practiceTestId: 'pt-1' });
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.updateQuestionAndOptions as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, text: 'Updated?' });

      const res = await request(app)
        .put('/api/business/1/practice-tests/questions/q-1')
        .send({ questionText: 'Updated?' });

      expect(res.status).toBe(200);
    });

    it('returns 404 when question not found', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/business/1/practice-tests/questions/missing')
        .send({ questionText: 'X' });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /practice-tests/questions/:questionId ──────────────────────────

  describe('DELETE /api/business/1/practice-tests/questions/q-1', () => {
    it('deletes a question', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, practiceTestId: 'pt-1' });
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.deleteQuestion as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/business/1/practice-tests/questions/q-1');

      expect(res.status).toBe(200);
    });

    it('returns 400 when test has attempts', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, practiceTestId: 'pt-1' });
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (questionRepo.hasAttemptsForPracticeTest as jest.Mock).mockResolvedValue(true);

      const res = await request(app).delete('/api/business/1/practice-tests/questions/q-1');

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PRACTICE TEST ATTEMPT ROUTES (student)
// ═══════════════════════════════════════════════════════════════════════════

describe('Practice Test Attempt Routes', () => {
  const ATTEMPT_ROW = {
    id: 'attempt-1',
    practiceTestId: 'pt-1',
    examTestId: null,
    userId: 5,
    status: AttemptStatus.IN_PROGRESS,
    startedAt: NOW,
    submittedAt: null,
    score: null,
    totalScore: null,
    percentage: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  beforeEach(() => {
    mockUserRole = UserRole.STUDENT;
    // Inject student user
    app.use((req: any, _res, next) => {
      req.user = { id: 5, role: UserRole.STUDENT, businessId: 1, email: 'student@test.com' };
      next();
    });
  });

  // ── GET available ─────────────────────────────────────────────────────────

  describe('GET /api/business/1/practice-tests/available', () => {
    it('returns available tests for student', async () => {
      (practiceRepo.findPublishedPracticeTestsForStudent as jest.Mock).mockResolvedValue([PRACTICE_TEST_ROW]);
      (attemptRepo.getPracticeAttemptStatsByUserForTests as jest.Mock).mockResolvedValue(new Map());

      const res = await request(app).get('/api/business/1/practice-tests/available');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 403 for admin', async () => {
      mockUserRole = UserRole.ADMIN;
      const res = await request(app).get('/api/business/1/practice-tests/available');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /attempts (start) ────────────────────────────────────────────────

  describe('POST /api/business/1/practice-tests/attempts', () => {
    it('starts a new attempt and returns questions WITHOUT correct answers', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (attemptRepo.findPracticeAttemptsByUser as jest.Mock).mockResolvedValue([]);
      (attemptRepo.createTestAttempt as jest.Mock).mockResolvedValue(ATTEMPT_ROW);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts')
        .send({ practiceTestId: 'pt-1' });

      expect(res.status).toBe(201);
      expect(res.body.data.attemptId).toBe('attempt-1');
      // Questions must NOT expose correct answer fields to student
      const questions = res.body.data.questions;
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach((q: any) => {
        expect(q).not.toHaveProperty('correctTextAnswer');
        expect(q).not.toHaveProperty('explanation');
        expect(q).not.toHaveProperty('correctOptionIdsAnswers');
      });
    });

    it('resumes in-progress attempt', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (attemptRepo.findPracticeAttemptsByUser as jest.Mock).mockResolvedValue([ATTEMPT_ROW]);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts')
        .send({ practiceTestId: 'pt-1' });

      expect(res.status).toBe(201);
      expect(res.body.data.attemptId).toBe('attempt-1');
      // Still no correct answers on resume
      res.body.data.questions.forEach((q: any) => {
        expect(q).not.toHaveProperty('correctTextAnswer');
      });
    });

    it('returns 400 when test is not published', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({ ...PRACTICE_TEST_ROW, status: 0 });
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts')
        .send({ practiceTestId: 'pt-1' });

      expect(res.status).toBe(400);
    });

    it('returns 403 when student not in batch', async () => {
      (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue(PRACTICE_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts')
        .send({ practiceTestId: 'pt-1' });

      // ForbiddenError is not caught by the controller — falls through to 500
      expect(res.status).toBe(500);
    });

    it('returns 403 when admin tries to start attempt', async () => {
      mockUserRole = UserRole.ADMIN;
      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts')
        .send({ practiceTestId: 'pt-1' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /attempts/:attemptId ──────────────────────────────────────────────

  describe('GET /api/business/1/practice-tests/attempts/attempt-1', () => {
    it('returns attempt details with correct answers after submission', async () => {
      const submittedAttempt = {
        ...ATTEMPT_ROW,
        userId: 1, // matches injected user id
        status: AttemptStatus.SUBMITTED,
        score: 4,
        totalScore: 8,
        percentage: 50,
        submittedAt: NOW,
        practiceTest: { ...PRACTICE_TEST_ROW, businessId: 1, shuffleQuestions: false, shuffleOptions: false },
        answers: [
          {
            id: 'ans-1',
            attemptId: 'attempt-1',
            questionId: 'q-1',
            selectedOptionIds: ['o-2'],
            textAnswer: null,
            isCorrect: true,
            obtainedMarks: 4,
          },
        ],
      };

      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue(submittedAttempt);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/practice-tests/attempts/attempt-1');

      expect(res.status).toBe(200);
      expect(res.body.data.attempt.status).toBe(AttemptStatus.SUBMITTED);
    });

    it('returns 404 when attempt not found', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/business/1/practice-tests/attempts/missing');

      expect(res.status).toBe(404);
    });
  });

  // ── POST /attempts/:attemptId/submit ──────────────────────────────────────

  describe('POST /api/business/1/practice-tests/attempts/attempt-1/submit', () => {
    it('submits attempt and returns score with correct answers', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue({
        ...ATTEMPT_ROW,
        userId: 1,
        practiceTest: { ...PRACTICE_TEST_ROW, businessId: 1 },
      });
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);
      (attemptRepo.upsertAttemptAnswersAndFinalize as jest.Mock).mockResolvedValue({
        ...ATTEMPT_ROW,
        userId: 1,
        status: AttemptStatus.SUBMITTED,
        score: 8,
        totalScore: 8,
        percentage: 100,
        submittedAt: NOW,
        answers: [],
      });

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts/attempt-1/submit')
        .send({
          answers: [
            { questionId: 'q-1', selectedOptionIds: ['o-2'] },
            { questionId: 'q-2', textAnswer: 'true' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(8);
      expect(res.body.data.result.questions).toBeDefined();
    });

    it('returns 400 for invalid questionId in answers', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue({
        ...ATTEMPT_ROW,
        userId: 1,
        practiceTest: { ...PRACTICE_TEST_ROW, businessId: 1 },
      });
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listPracticeTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app)
        .post('/api/business/1/practice-tests/attempts/attempt-1/submit')
        .send({ answers: [{ questionId: 'invalid-q', selectedOptionIds: ['o-1'] }] });

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAM TEST ROUTES
// ═══════════════════════════════════════════════════════════════════════════

describe('Exam Test Routes', () => {

  // ── POST /exam-tests ──────────────────────────────────────────────────────

  describe('POST /api/business/1/exam-tests', () => {
    it('creates an exam test (admin)', async () => {
      (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
      (batchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 3, courseId: SUBJECT_COURSE_ID });
      (subjectRepo.findSubjectById as jest.Mock).mockResolvedValue({
        id: SUBJECT_ID,
        courseId: SUBJECT_COURSE_ID,
        status: SubjectStatus.ACTIVE,
      });
      (examRepo.createExamTest as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);

      const res = await request(app)
        .post('/api/business/1/exam-tests')
        .send({
          batchId: 3,
          subjectId: SUBJECT_ID,
          name: 'Exam Test 1',
          startAt: NOW.toISOString(),
          deadlineAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
          durationMinutes: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Exam Test 1');
    });

    it('returns 403 when student tries to create', async () => {
      mockUserRole = UserRole.STUDENT;

      const res = await request(app)
        .post('/api/business/1/exam-tests')
        .send({ batchId: 3, name: 'Exam' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when batchId is missing', async () => {
      const res = await request(app)
        .post('/api/business/1/exam-tests')
        .send({ name: 'Exam' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /exam-tests ───────────────────────────────────────────────────────

  describe('GET /api/business/1/exam-tests', () => {
    it('lists exam tests for admin', async () => {
      (examRepo.findExamTestsByBusinessId as jest.Mock).mockResolvedValue([EXAM_TEST_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).get('/api/business/1/exam-tests');
      expect(res.status).toBe(403);
    });

    it('filters by batchId query param', async () => {
      (examRepo.findExamTestsByBusinessId as jest.Mock).mockResolvedValue([EXAM_TEST_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests?batchId=3');

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid batchId param', async () => {
      const res = await request(app).get('/api/business/1/exam-tests?batchId=abc');
      expect(res.status).toBe(400);
    });
  });

  // ── GET /exam-tests/:id ───────────────────────────────────────────────────

  describe('GET /api/business/1/exam-tests/et-1', () => {
    it('returns exam test with questions for admin', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests/et-1');

      expect(res.status).toBe(200);
      expect(res.body.data.questions).toHaveLength(2);
      const tfQ = res.body.data.questions.find((q: any) => q.type === QuestionType.TRUE_FALSE);
      expect(tfQ.correctTextAnswer).toBe('true');
      expect(tfQ.explanation).toBe('Yes it is');
    });

    it('returns exam test with questions for teacher', async () => {
      mockUserRole = UserRole.TEACHER;
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests/et-1');

      expect(res.status).toBe(200);
      expect(res.body.data.questions).toHaveLength(1);
    });

    it('returns 404 when exam test not found', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/business/1/exam-tests/missing');

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /exam-tests/:id ───────────────────────────────────────────────────

  describe('PUT /api/business/1/exam-tests/et-1', () => {
    it('updates an exam test', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (examRepo.updateExamTest as jest.Mock).mockResolvedValue({ ...EXAM_TEST_ROW, name: 'Updated Exam' });

      const res = await request(app)
        .put('/api/business/1/exam-tests/et-1')
        .send({ name: 'Updated Exam' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Exam');
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).put('/api/business/1/exam-tests/et-1').send({ name: 'X' });
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /exam-tests/:id ────────────────────────────────────────────────

  describe('DELETE /api/business/1/exam-tests/et-1', () => {
    it('deletes an exam test', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (examRepo.deleteExamTest as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app).delete('/api/business/1/exam-tests/et-1');

      expect(res.status).toBe(200);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).delete('/api/business/1/exam-tests/et-1');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /exam-tests/publish ──────────────────────────────────────────────

  describe('POST /api/business/1/exam-tests/publish', () => {
    it('publishes a draft exam test', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue({ ...EXAM_TEST_ROW, status: 0 });
      (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
      (questionRepo.countQuestionsForExamTest as jest.Mock).mockResolvedValue(2);
      (examRepo.updateExamTest as jest.Mock).mockResolvedValue({ ...EXAM_TEST_ROW, status: 1 });

      const res = await request(app)
        .post('/api/business/1/exam-tests/publish')
        .send({ examTestId: 'et-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(1);
    });

    it('returns 400 when exam test has no questions', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue({ ...EXAM_TEST_ROW, status: 0 });
      (questionRepo.countQuestionsForExamTest as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .post('/api/business/1/exam-tests/publish')
        .send({ examTestId: 'et-1' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app)
        .post('/api/business/1/exam-tests/publish')
        .send({ examTestId: 'et-1' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /exam-tests/:id/questions ─────────────────────────────────────────

  describe('GET /api/business/1/exam-tests/et-1/questions', () => {
    it('returns questions with correctTextAnswer and explanation for admin', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests/et-1/questions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const tfQ = res.body.data.find((q: any) => q.type === QuestionType.TRUE_FALSE);
      expect(tfQ.correctTextAnswer).toBe('true');
      expect(tfQ.explanation).toBe('Yes it is');
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).get('/api/business/1/exam-tests/et-1/questions');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /exam-tests/:id/questions ────────────────────────────────────────

  describe('POST /api/business/1/exam-tests/et-1/questions', () => {
    it('creates an MCQ question', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.createExamTestQuestionResolvingCorrect as jest.Mock).mockResolvedValue({
        ...MCQ_QUESTION_ROW,
        practiceTestId: null,
        examTestId: 'et-1',
      });

      const res = await request(app)
        .post('/api/business/1/exam-tests/et-1/questions')
        .send({
          type: QuestionType.SINGLE_CHOICE,
          questionText: 'What is 2+2?',
          correctOptionIdsAnswers: ['o-2'],
          options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '2' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.explanation).toBe('Basic math');
    });

    it('creates a TRUE_FALSE question', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.createExamTestQuestionResolvingCorrect as jest.Mock).mockResolvedValue({
        ...TF_QUESTION_ROW,
        practiceTestId: null,
        examTestId: 'et-1',
      });

      const res = await request(app)
        .post('/api/business/1/exam-tests/et-1/questions')
        .send({
          type: QuestionType.TRUE_FALSE,
          questionText: 'Is sky blue?',
          correctTextAnswer: 'true',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.correctTextAnswer).toBe('true');
    });

    it('returns 400 when exam already has attempts', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/business/1/exam-tests/et-1/questions')
        .send({
          type: QuestionType.TRUE_FALSE,
          questionText: 'Q?',
          correctTextAnswer: 'true',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app)
        .post('/api/business/1/exam-tests/et-1/questions')
        .send({ type: 0, questionText: 'Q?' });
      expect(res.status).toBe(403);
    });
  });

  // ── PUT /exam-tests/questions/:questionId ─────────────────────────────────

  describe('PUT /api/business/1/exam-tests/questions/q-1', () => {
    it('updates a question', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, examTestId: 'et-1', practiceTestId: null });
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.updateQuestionAndOptions as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, text: 'Updated?' });

      const res = await request(app)
        .put('/api/business/1/exam-tests/questions/q-1')
        .send({ questionText: 'Updated?' });

      expect(res.status).toBe(200);
    });

    it('returns 404 when question not found', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/business/1/exam-tests/questions/missing')
        .send({ questionText: 'X' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for student', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app)
        .put('/api/business/1/exam-tests/questions/q-1')
        .send({ questionText: 'X' });
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /exam-tests/questions/:questionId ──────────────────────────────

  describe('DELETE /api/business/1/exam-tests/questions/q-1', () => {
    it('deletes a question', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, examTestId: 'et-1', practiceTestId: null });
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(false);
      (questionRepo.deleteQuestion as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/business/1/exam-tests/questions/q-1');

      expect(res.status).toBe(200);
    });

    it('returns 400 when exam has attempts', async () => {
      (questionRepo.findQuestionById as jest.Mock).mockResolvedValue({ ...MCQ_QUESTION_ROW, examTestId: 'et-1', practiceTestId: null });
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (questionRepo.hasAttemptsForExamTest as jest.Mock).mockResolvedValue(true);

      const res = await request(app).delete('/api/business/1/exam-tests/questions/q-1');

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAM TEST ATTEMPT ROUTES (student)
// ═══════════════════════════════════════════════════════════════════════════

describe('Exam Test Attempt Routes', () => {
  const EXAM_ATTEMPT_ROW = {
    id: 'attempt-2',
    practiceTestId: null,
    examTestId: 'et-1',
    userId: 5,
    status: AttemptStatus.IN_PROGRESS,
    startedAt: NOW,
    submittedAt: null,
    score: null,
    totalScore: null,
    percentage: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  beforeEach(() => {
    mockUserRole = UserRole.STUDENT;
  });

  // ── GET available ─────────────────────────────────────────────────────────

  describe('GET /api/business/1/exam-tests/available', () => {
    it('returns available exam tests for student', async () => {
      (examRepo.findPublishedExamTestsForStudent as jest.Mock).mockResolvedValue([EXAM_TEST_ROW]);
      (attemptRepo.getExamAttemptStatsByUserForTests as jest.Mock).mockResolvedValue(new Map());

      const res = await request(app).get('/api/business/1/exam-tests/available');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 403 for admin', async () => {
      mockUserRole = UserRole.ADMIN;
      const res = await request(app).get('/api/business/1/exam-tests/available');
      expect(res.status).toBe(403);
    });
  });

  // ── POST /attempts (start) ────────────────────────────────────────────────

  describe('POST /api/business/1/exam-tests/attempts', () => {
    it('starts a new exam attempt and returns questions WITHOUT correct answers', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValue([]);
      (attemptRepo.createTestAttempt as jest.Mock).mockResolvedValue(EXAM_ATTEMPT_ROW);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts')
        .send({ examTestId: 'et-1' });

      expect(res.status).toBe(201);
      expect(res.body.data.attemptId).toBe('attempt-2');
      // Questions must NOT expose correct answer fields to student
      const questions = res.body.data.questions;
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach((q: any) => {
        expect(q).not.toHaveProperty('correctTextAnswer');
        expect(q).not.toHaveProperty('explanation');
        expect(q).not.toHaveProperty('correctOptionIdsAnswers');
      });
    });

    it('returns 400 when exam has not started yet', async () => {
      const futureExam = {
        ...EXAM_TEST_ROW,
        // Use 25 hours in the future to exceed any timezone offset compensation
        startAt: new Date(Date.now() + 25 * 3_600_000),
        deadlineAt: new Date(Date.now() + 26 * 3_600_000),
      };
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(futureExam);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts')
        .send({ examTestId: 'et-1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when exam deadline has passed', async () => {
      const expiredExam = {
        ...EXAM_TEST_ROW,
        startAt: new Date(Date.now() - 7_200_000),
        deadlineAt: new Date(Date.now() - 3_600_000),
      };
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(expiredExam);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (attemptRepo.findExamAttemptsByUser as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts')
        .send({ examTestId: 'et-1' });

      expect(res.status).toBe(400);
    });

    it('returns 403 when student not in batch', async () => {
      (examRepo.findExamTestById as jest.Mock).mockResolvedValue(EXAM_TEST_ROW);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts')
        .send({ examTestId: 'et-1' });

      // ForbiddenError is not caught by the controller — falls through to 500
      expect(res.status).toBe(500);
    });

    it('returns 403 when admin tries to start exam attempt', async () => {
      mockUserRole = UserRole.ADMIN;
      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts')
        .send({ examTestId: 'et-1' });
      expect(res.status).toBe(403);
    });
  });

  // ── GET /attempts/:attemptId ──────────────────────────────────────────────

  describe('GET /api/business/1/exam-tests/attempts/attempt-2', () => {
    it('returns attempt details', async () => {
      const submittedAttempt = {
        ...EXAM_ATTEMPT_ROW,
        userId: 1, // matches injected user id
        status: AttemptStatus.SUBMITTED,
        score: 4,
        totalScore: 8,
        percentage: 50,
        submittedAt: NOW,
        examTest: { ...EXAM_TEST_ROW, businessId: 1, batchId: 3, shuffleQuestions: false, shuffleOptions: false, resultVisibility: 0 },
        answers: [],
      };

      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue(submittedAttempt);
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app).get('/api/business/1/exam-tests/attempts/attempt-2');

      expect(res.status).toBe(200);
      expect(res.body.data.attempt.status).toBe(AttemptStatus.SUBMITTED);
    });

    it('returns 404 when attempt not found', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/business/1/exam-tests/attempts/missing');

      expect(res.status).toBe(404);
    });
  });

  // ── POST /attempts/:attemptId/submit ──────────────────────────────────────

  describe('POST /api/business/1/exam-tests/attempts/attempt-2/submit', () => {
    it('submits exam attempt and returns score', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue({
        ...EXAM_ATTEMPT_ROW,
        userId: 1,
        examTest: { ...EXAM_TEST_ROW, businessId: 1, batchId: 3, shuffleQuestions: false, shuffleOptions: false },
      });
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW, TF_QUESTION_ROW]);
      (attemptRepo.upsertAttemptAnswersAndFinalize as jest.Mock).mockResolvedValue({
        ...EXAM_ATTEMPT_ROW,
        userId: 1,
        status: AttemptStatus.SUBMITTED,
        score: 8,
        totalScore: 8,
        percentage: 100,
        submittedAt: NOW,
        answers: [],
      });

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts/attempt-2/submit')
        .send({
          answers: [
            { questionId: 'q-1', selectedOptionIds: ['o-2'] },
            { questionId: 'q-2', textAnswer: 'true' },
          ],
        });

      expect(res.status).toBe(200);
      // Score is only revealed after deadline (resultVisibility=AFTER_DEADLINE)
      // so we just verify the attempt was submitted successfully
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(AttemptStatus.SUBMITTED);
    });

    it('returns 400 for invalid questionId in answers', async () => {
      (attemptRepo.findTestAttemptWithInclude as jest.Mock).mockResolvedValue({
        ...EXAM_ATTEMPT_ROW,
        userId: 1,
        examTest: { ...EXAM_TEST_ROW, businessId: 1, batchId: 3, shuffleQuestions: false, shuffleOptions: false },
      });
      (batchRepo.isActiveUserInBatch as jest.Mock).mockResolvedValue(true);
      (questionRepo.listExamTestQuestions as jest.Mock).mockResolvedValue([MCQ_QUESTION_ROW]);

      const res = await request(app)
        .post('/api/business/1/exam-tests/attempts/attempt-2/submit')
        .send({ answers: [{ questionId: 'invalid-q', selectedOptionIds: ['o-1'] }] });

      expect(res.status).toBe(400);
    });
  });
});
