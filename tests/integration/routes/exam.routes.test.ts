import request from 'supertest';
import express from 'express';
import examRoutes from '../../../src/routes/exam.routes';

import * as ExamRepo from '../../../src/repositories/exam.repo';
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
    authorizeExamAccess: (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
app.use('/api/exams', examRoutes);
app.use(errorHandler);

describe('Exam Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/exams', () => {
        it('should create an exam', async () => {
            logger.info('TEST: Starting POST /api/exams success test');
            const examData = { name: 'Test Exam', businessId: 1 };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.createExam as jest.Mock).mockResolvedValue({ id: 1, ...examData });

            const res = await request(app).post('/api/exams').send(examData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.name).toBe('Test Exam');
        });

        it('should return 400 if validation fails', async () => {
            logger.info('TEST: Starting POST /api/exams validation failure test');
            const examData = { name: '', businessId: 1 }; // Invalid name

            const res = await request(app).post('/api/exams').send(examData);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Exam name is required');
        });

        it('should return 404 if business not found', async () => {
            logger.info('TEST: Starting POST /api/exams business not found test');
            const examData = { name: 'Test Exam', businessId: 999 };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).post('/api/exams').send(examData);

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/exams/:id', () => {
        it('should return an exam', async () => {
            logger.info('TEST: Starting GET /api/exams/:id success test');
            const mockExam = { id: 1, name: 'Test Exam' };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            const res = await request(app).get('/api/exams/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockExam);
        });

        it('should return 404 if exam not found', async () => {
            logger.info('TEST: Starting GET /api/exams/:id not found test');
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/exams/999');

            expect(res.status).toBe(404);
        });

        it('should return 400 if ID is invalid', async () => {
            logger.info('TEST: Starting GET /api/exams/:id invalid ID test');
            const res = await request(app).get('/api/exams/invalid');
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/exams', () => {
        it('should return exams for a business', async () => {
            logger.info('TEST: Starting GET /api/exams success test');
            const mockExams = [{ id: 1, name: 'Exam 1' }];
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.findActiveExamsByBusinessId as jest.Mock).mockResolvedValue(mockExams);

            const res = await request(app).get('/api/exams').query({ businessId: 1 });

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('should return 400 if businessId is missing', async () => {
            logger.info('TEST: Starting GET /api/exams missing businessId test');
            const res = await request(app).get('/api/exams');
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/exams/:id', () => {
        it('should update an exam', async () => {
            logger.info('TEST: Starting PUT /api/exams/:id success test');
            const updatedExam = { id: 1, name: 'Updated Exam' };
            (ExamRepo.updateExam as jest.Mock).mockResolvedValue(updatedExam);

            const res = await request(app).put('/api/exams/1').send({ name: 'Updated Exam' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Exam');
        });

        it('should return 400 if validation fails', async () => {
            logger.info('TEST: Starting PUT /api/exams/:id validation failure test');
            const res = await request(app).put('/api/exams/1').send({ name: '' }); // Empty name
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/exams/:id', () => {
        it('should delete an exam', async () => {
            logger.info('TEST: Starting DELETE /api/exams/:id success test');
            (ExamRepo.deleteExam as jest.Mock).mockResolvedValue({ id: 1, status: 'INACTIVE' });

            const res = await request(app).delete('/api/exams/1');

            expect(res.status).toBe(200);
        });

        it('should return 400 if ID is invalid', async () => {
            logger.info('TEST: Starting DELETE /api/exams/:id invalid ID test');
            const res = await request(app).delete('/api/exams/invalid');
            expect(res.status).toBe(400);
        });
    });
});
