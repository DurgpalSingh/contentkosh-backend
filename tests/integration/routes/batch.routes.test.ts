import request from 'supertest';
import express from 'express';
import batchRoutes from '../../../src/routes/batch.routes';
import * as BatchRepo from '../../../src/repositories/batch.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as UserRepo from '../../../src/repositories/user.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

import * as ExamRepo from '../../../src/repositories/exam.repo';

// Mock dependencies
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => next(),
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
// Middleware to simulate authenticated user
app.use((req: any, res, next) => {
    req.user = { id: 1, businessId: 1, role: 'ADMIN' };
    next();
});
app.use('/api/batches', batchRoutes);
app.use(errorHandler);

describe('Batch Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== BATCH CRUD ROUTES ====================

    describe('POST /api/batches', () => {
        const validBatchData = {
            codeName: 'BATCH001',
            displayName: 'Test Batch',
            startDate: '2024-01-01',
            endDate: '2024-06-30',
            courseId: 1
        };

        it('should create a batch', async () => {
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Course' });
            // findBatchByCodeName removed from service, so no need to mock for success case
            (BatchRepo.createBatch as jest.Mock).mockResolvedValue({ id: 1, ...validBatchData });

            const res = await request(app)
                .post('/api/batches')
                .send(validBatchData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.codeName).toBe('BATCH001');
        });

        it('should return 400 if codeName is missing', async () => {
            const res = await request(app)
                .post('/api/batches')
                .send({ ...validBatchData, codeName: '' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Batch code name is required');
        });

        it('should return 404 if course not found', async () => {
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/batches')
                .send(validBatchData);

            expect(res.status).toBe(404);
        });

        it('should return 409 if codeName already exists', async () => {
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1 });
            // Service now catches P2002 from createBatch
            const error: any = new Error('Unique constraint failed');
            error.code = 'P2002';
            (BatchRepo.createBatch as jest.Mock).mockRejectedValue(error);

            const res = await request(app)
                .post('/api/batches')
                .send(validBatchData);

            expect(res.status).toBe(409);
        });
    });

    describe('GET /api/batches/:id', () => {
        it('should return a batch by ID', async () => {
            const mockBatch = {
                id: 1,
                codeName: 'BATCH001',
                displayName: 'Test Batch',
                course: { examId: 1 }
            };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(mockBatch);
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            const res = await request(app).get('/api/batches/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockBatch);
        });

        it('should return 404 if batch not found', async () => {
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/batches/999');

            expect(res.status).toBe(404);
        });

        it('should return 400 if id is invalid', async () => {
            const res = await request(app).get('/api/batches/invalid');

            expect(res.status).toBe(400);
        });
    });


    describe('GET /api/batches/course/:courseId', () => {
        it('should return batches for a course', async () => {
            const mockBatches = [
                { id: 1, codeName: 'BATCH001' },
                { id: 2, codeName: 'BATCH002' }
            ];
            (BatchRepo.findBatchesByCourseId as jest.Mock).mockResolvedValue(mockBatches);
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, examId: 1 });
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            const res = await request(app).get('/api/batches/course/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('should return 400 if courseId is invalid', async () => {
            const res = await request(app).get('/api/batches/course/invalid');

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/batches/:id', () => {
        it('should update a batch', async () => {
            const batch = { id: 1, codeName: 'BATCH001', displayName: 'Old Batch', course: { examId: 1 } };
            const updatedBatch = { id: 1, codeName: 'BATCH001', displayName: 'Updated Batch', course: { examId: 1 } };

            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch); // Middleware & Service check
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (BatchRepo.updateBatch as jest.Mock).mockResolvedValue(updatedBatch);

            // redundant findBatchByCodeName removed from service

            const res = await request(app)
                .put('/api/batches/1')
                .send({ displayName: 'Updated Batch' });

            expect(res.status).toBe(200);
            expect(res.body.data.displayName).toBe('Updated Batch');
        });

        it('should return 409 if updating to existing codeName', async () => {
            const batch = { id: 1, codeName: 'BATCH001', course: { examId: 1 } };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch);
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            const error: any = new Error('Unique constraint failed');
            error.code = 'P2002';
            (BatchRepo.updateBatch as jest.Mock).mockRejectedValue(error);

            const res = await request(app)
                .put('/api/batches/1')
                .send({ codeName: 'BATCH002' }); // Assume BATCH002 exists

            expect(res.status).toBe(409);
        });

        it('should return 400 if codeName is empty', async () => {
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 1, courseId: 1, course: { examId: 1 } });
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, examId: 1 });
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            const res = await request(app)
                .put('/api/batches/1')
                .send({ codeName: '   ' });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/batches/:id', () => {
        it('should delete a batch', async () => {
            const batch = { id: 1, codeName: 'BATCH001', course: { examId: 1 } };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch); // Middleware
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (BatchRepo.deleteBatch as jest.Mock).mockResolvedValue({ id: 1 });

            // Service deleteBatch calls repo.deleteBatch. It doesn't check existence itself efficiently?
            // Actually service calls deleteBatch. Repo throws if not found?
            // Middleware ensures existence.

            const res = await request(app).delete('/api/batches/1');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Batch deleted successfully');
        });

        it('should return 400 if id is invalid', async () => {
            const res = await request(app).delete('/api/batches/invalid');

            expect(res.status).toBe(400);
        });
    });

    // ==================== BATCH USER ROUTES ====================

    describe('POST /api/batches/add-user', () => {
        it('should add user to batch', async () => {
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({
                id: 1,
                name: 'Test User',
                businessUsers: [{ business: { id: 1 }, role: 'STUDENT', isActive: true }]
            });
            // Mock deep select for batch
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({
                id: 1,
                codeName: 'BATCH001',
                course: { exam: { businessId: 1 } }
            });
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);
            (BatchRepo.addUserToBatch as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });

            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(201);
            expect(res.body.message).toContain('User added to batch successfully');
        });

        it('should return 400 if userId or batchId is missing', async () => {
            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1 });

            expect(res.status).toBe(400);
        });

        it('should return 409 if user is already in batch', async () => {
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({
                id: 1,
                businessUsers: [{ business: { id: 1 }, role: 'STUDENT', isActive: true }]
            });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({
                id: 1,
                codeName: 'BATCH001',
                course: { exam: { businessId: 1 } }
            });
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });

            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(409);
        });

        it('should return 400 if user role is invalid (e.g. ADMIN)', async () => {
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({
                id: 1,
                name: 'Admin User',
                businessUsers: [{ business: { id: 1 }, role: 'ADMIN', isActive: true }]
            });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({
                id: 1,
                codeName: 'BATCH001',
                course: { exam: { businessId: 1 } }
            });

            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Only Teachers and Students');
        });

        it('should return 400 if user is not in the business', async () => {
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({
                id: 1,
                name: 'Other Biz User',
                businessUsers: [{ business: { id: 2 }, role: 'STUDENT', isActive: true }]
            });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({
                id: 1,
                codeName: 'BATCH001',
                course: { exam: { businessId: 1 } }
            });

            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('User is not part of this business');
        });
    });

    describe('POST /api/batches/remove-user', () => {
        it('should remove user from batch', async () => {
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });
            (BatchRepo.removeUserFromBatch as jest.Mock).mockResolvedValue({ id: 1 });

            const res = await request(app)
                .post('/api/batches/remove-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('User removed from batch successfully');
        });

        it('should return 404 if user is not in batch', async () => {
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/batches/remove-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/batches/user/:userId', () => {
        it('should return batches for a user', async () => {
            const mockBatchUsers = [{ id: 1, batch: { id: 1, codeName: 'BATCH001' } }];
            (BatchRepo.findBatchesByUserId as jest.Mock).mockResolvedValue(mockBatchUsers);

            const res = await request(app).get('/api/batches/user/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('should return 400 if userId is invalid', async () => {
            const res = await request(app).get('/api/batches/user/invalid');

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/batches/:batchId/users', () => {
        it('should return users for a batch', async () => {
            const batch = { id: 1, course: { examId: 1 } };
            const mockBatchUsers = [{ id: 1, user: { id: 1, name: 'User 1' } }];

            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch); // Middleware
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (BatchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockBatchUsers);

            const res = await request(app).get('/api/batches/1/users');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('should return 400 if batchId is invalid', async () => {
            const res = await request(app).get('/api/batches/invalid/users');

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/batches/:batchId/users/:userId', () => {
        it('should update batch user status', async () => {
            const batch = { id: 1, course: { examId: 1 } };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch); // Middleware
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });
            (BatchRepo.updateBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1, isActive: false });

            const res = await request(app)
                .put('/api/batches/1/users/1')
                .send({ isActive: false });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Batch user updated successfully');
        });

        it('should return 404 if user is not in batch', async () => {
            const batch = { id: 1, course: { examId: 1 } };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(batch); // Middleware
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });

            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .put('/api/batches/1/users/1')
                .send({ isActive: false });

            expect(res.status).toBe(404);
        });
    });
});

