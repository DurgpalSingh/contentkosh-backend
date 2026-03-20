import request from 'supertest';
import express from 'express';

import businessRoutes from '../../../src/routes/business.routes';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

import * as practiceRepo from '../../../src/repositories/practice-test.repo';
import * as examRepo from '../../../src/repositories/exam-test.repo';
import * as attemptRepo from '../../../src/repositories/test-attempt.repo';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/repositories/practice-test.repo');
jest.mock('../../../src/repositories/exam-test.repo');
jest.mock('../../../src/repositories/test-attempt.repo');

describe('Test Module - Analytics routes', () => {
  const app = express();
  app.use(express.json());

  let mockRole: string = 'ADMIN';

  app.use((req: any, _res, next) => {
    req.user = { id: 1, role: mockRole, businessId: 1 };
    next();
  });

  app.use('/api/business', businessRoutes);
  app.use(errorHandler);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'ADMIN';
  });

  it('GET practice analytics returns computed TestAnalytics', async () => {
    (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({
      id: 'practice-1',
      businessId: 1,
      batchId: 10,
      status: 1,
      defaultMarksPerQuestion: 1,
    });

    (attemptRepo.getPracticeTestAnalyticsAttempts as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        userId: 2,
        status: 1,
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        submittedAt: new Date('2026-03-20T10:01:00.000Z'),
        score: 3,
        totalScore: 5,
        percentage: 60,
      },
      {
        id: 'a2',
        userId: 3,
        status: 2,
        startedAt: new Date('2026-03-20T10:05:00.000Z'),
        submittedAt: new Date('2026-03-20T10:06:00.000Z'),
        score: 2,
        totalScore: 5,
        percentage: 40,
      },
    ]);

    (attemptRepo.getPracticeTestQuestionIds as jest.Mock).mockResolvedValue(['q1', 'q2']);
    (attemptRepo.getPracticeTestCorrectCountsByQuestion as jest.Mock).mockResolvedValue([
      { questionId: 'q1', correctCount: 2 },
      { questionId: 'q2', correctCount: 0 },
    ]);

    const res = await request(app).get('/api/business/1/practice-tests/practice-1/analytics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAttempts).toBe(2);
    expect(res.body.data.averageScore).toBe(2.5);
    expect(res.body.data.passRate).toBe(50);
    expect(res.body.data.questionStats).toHaveLength(2);
  });

  it('GET practice analytics export returns csv attachment', async () => {
    (practiceRepo.findPracticeTestById as jest.Mock).mockResolvedValue({
      id: 'practice-1',
      businessId: 1,
      batchId: 10,
      status: 1,
      defaultMarksPerQuestion: 1,
    });

    (attemptRepo.getPracticeTestAnalyticsAttemptsForExport as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        userId: 2,
        status: 1,
        startedAt: new Date('2026-03-20T10:00:00.000Z'),
        submittedAt: new Date('2026-03-20T10:01:00.000Z'),
        score: 3,
        totalScore: 5,
        percentage: 60,
        user: { name: 'Alice', email: 'alice@example.com' },
      },
    ]);

    const res = await request(app).get('/api/business/1/practice-tests/practice-1/analytics/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('attemptId,userId,userName,userEmail');
    expect(res.text).toContain('a1,2,Alice,alice@example.com');
  });

  it('returns 400 for invalid businessId param', async () => {
    const res = await request(app).get('/api/business/abc/practice-tests/practice-1/analytics');
    expect(res.status).toBe(400);
  });

  it('returns 403 when role is not allowed', async () => {
    mockRole = 'STUDENT';
    const res = await request(app).get('/api/business/1/practice-tests/practice-1/analytics');
    expect(res.status).toBe(403);
  });
});

