import 'reflect-metadata';
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
    authorize: () => (req: any, res: any, next: any) => {
        req.user = { id: 1, role: 'ADMIN' };
        next();
    },
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
    authorizeExamAccess: (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

import businessRoutes from '../../../src/routes/business.routes';

// ...

const app = express();
app.use(express.json());
// Middleware to simulate authenticated user for routes that read req.user directly
app.use((req: any, res, next) => {
    req.user = { id: 1, role: 'ADMIN', businessId: 1, email: 'test@example.com', name: 'Tester' };
    next();
});
app.use('/api/exams', examRoutes);
app.use('/api/business', businessRoutes);
app.use(errorHandler);

describe('Exam Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/business/:businessId/exams', () => {
        it('should create an exam', async () => {
            logger.info('TEST: Starting POST /api/business/1/exams success test');
            const examData = { name: 'Test Exam', businessId: 1 };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.createExam as jest.Mock).mockResolvedValue({ id: 1, ...examData });

            const res = await request(app).post('/api/business/1/exams').send(examData);

            if (res.status !== 201) {
                // console.error('TEST FAILED: POST /api/business/1/exams', res.status, res.body);
            }

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.name).toBe('Test Exam');
        });

        it('should return 400 if validation fails', async () => {
            logger.info('TEST: Starting POST /api/business/1/exams validation failure test');
            const examData = { name: '', businessId: 1 }; // Invalid name

            const res = await request(app).post('/api/business/1/exams').send(examData);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Exam name is required'); // Or whatever the DTO error message is
        });

        it('should return 404 if business not found', async () => {
            logger.info('TEST: Starting POST /api/business/999/exams business not found test');
            const examData = { name: 'Test Exam', businessId: 999 };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).post('/api/business/999/exams').send(examData);

            expect(res.status).toBe(404);
        });
    });

    // ... GET /:id tests remain same ...

    describe('GET /api/business/:businessId/exams', () => {
        it('should return exams for a business', async () => {
            logger.info('TEST: Starting GET /api/business/1/exams success test');
            const mockExams = [{ id: 1, name: 'Exam 1' }];
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.findActiveExamsByBusinessId as jest.Mock).mockResolvedValue(mockExams);

            const res = await request(app).get('/api/business/1/exams');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('should support pagination options', async () => {
            const mockExams = [{ id: 1, name: 'Active Exam' }];
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.findActiveExamsByBusinessId as jest.Mock).mockResolvedValue(mockExams);

            // Test pagination params which QueryBuilder DOES parse
            const res = await request(app).get('/api/business/1/exams?page=1&limit=10');

            expect(res.status).toBe(200);
            // Verify options passed map to skip/take
            expect(ExamRepo.findActiveExamsByBusinessId).toHaveBeenCalledWith(1, expect.objectContaining({ skip: 0, take: 10 }));
        });

        // Removed "missing businessId" test because route param is required by definition in express route
    });

    describe('GET /api/business/:businessId/exams/:id', () => {
        it('should get an exam by ID', async () => {
            logger.info('TEST: Starting GET /api/business/1/exams/1 success test');
            // We need to mock getExam to return an exam with businessId matching the URL
            const mockExam = { id: 1, name: 'Physics I', businessId: 1 };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            const res = await request(app).get('/api/business/1/exams/1');

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(1);
        });

        it('should return 404 if exam belongs to another business', async () => {
            // Mock exam belonging to business 2, but we request via business 1
            const mockExam = { id: 1, name: 'Physics I', businessId: 2 };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            const res = await request(app).get('/api/business/1/exams/1');

            // Controller checks exam.businessId !== params.businessId -> 404
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/business/:businessId/exams/:id', () => {
        it('should update an exam', async () => {
            logger.info('TEST: Starting PUT /api/business/1/exams/:id success test');
            const updatedExam = { id: 1, name: 'Updated Exam', businessId: 1 };

            // Mock getExam check
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            // Mock update
            (ExamRepo.updateExam as jest.Mock).mockResolvedValue(updatedExam);

            const res = await request(app).put('/api/business/1/exams/1').send({ name: 'Updated Exam' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Exam');
        });

        it('should return 400 if validation fails', async () => {
            logger.info('TEST: Starting PUT /api/business/1/exams/:id validation failure test');
            const res = await request(app).put('/api/business/1/exams/1').send({ name: '' });
            expect(res.status).toBe(400);
        });

        it('should return 404 if exam not found', async () => {
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).put('/api/business/1/exams/999').send({ name: 'Updated' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/business/:businessId/exams/:id', () => {
        it('should delete an exam', async () => {
            logger.info('TEST: Starting DELETE /api/business/1/exams/:id success test');

            // Mock getExam check
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (ExamRepo.deleteExam as jest.Mock).mockResolvedValue({ id: 1, status: 'INACTIVE' });

            const res = await request(app).delete('/api/business/1/exams/1');

            expect(res.status).toBe(200);
        });

        it('should return 404 if exam not found', async () => {
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).delete('/api/business/1/exams/999');

            expect(res.status).toBe(404);
        });
    });
});
