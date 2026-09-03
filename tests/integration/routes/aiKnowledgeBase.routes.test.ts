import express from 'express';
import request from 'supertest';
import { UserRole } from '@prisma/client';

var mockQueryKnowledgeBase: jest.Mock;

jest.mock('../../../src/services/aiKnowledgeBase.service', () => ({
  AiKnowledgeBaseService: jest.fn().mockImplementation(() => ({
    queryKnowledgeBase: (...args: unknown[]) => mockQueryKnowledgeBase(...args),
  })),
}));
jest.mock('../../../src/utils/logger');

import { aiKnowledgeBaseRouter } from '../../../src/routes/aiKnowledgeBase.routes';
import { errorHandler } from '../../../src/middlewares/error.middleware';

describe('AI Knowledge Base Routes', () => {
  let currentUser: any;
  const app = express();

  beforeAll(() => {
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = currentUser;
      next();
    });
    app.use('/api/business', aiKnowledgeBaseRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    currentUser = { id: 1, email: 'student@test.com', role: UserRole.STUDENT, businessId: 1 };
    mockQueryKnowledgeBase = jest.fn();
    mockQueryKnowledgeBase.mockResolvedValue({ answer: 'Answer' });
  });

  it('returns an answer for an authorized student', async () => {
    const response = await request(app)
      .post('/api/business/1/ai/kb/query')
      .send({ courseId: 2, query: 'What is photosynthesis?' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ answer: 'Answer' });
  });

  it('returns 403 for non-student users', async () => {
    currentUser = { id: 1, email: 'teacher@test.com', role: UserRole.TEACHER, businessId: 1 };

    const response = await request(app)
      .post('/api/business/1/ai/kb/query')
      .send({ courseId: 2, query: 'What is photosynthesis?' });

    expect(response.status).toBe(403);
  });

  it('returns 403 for cross-business access', async () => {
    const response = await request(app)
      .post('/api/business/2/ai/kb/query')
      .send({ courseId: 2, query: 'What is photosynthesis?' });

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/api/business/1/ai/kb/query')
      .send({ courseId: 0, query: '' });

    expect(response.status).toBe(400);
  });
});
