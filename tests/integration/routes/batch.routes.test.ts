import request from 'supertest';
import express from 'express';
import batchRoutes from '../../../src/routes/batch.routes';
import * as BatchRepo from '../../../src/repositories/batch.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as UserRepo from '../../../src/repositories/user.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
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
            (BatchRepo.findBatchByCodeName as jest.Mock).mockResolvedValue(null);
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
            (BatchRepo.findBatchByCodeName as jest.Mock).mockResolvedValue({ id: 2, codeName: 'BATCH001' });

            const res = await request(app)
                .post('/api/batches')
                .send(validBatchData);

            expect(res.status).toBe(409);
        });
    });

    describe('GET /api/batches/:id', () => {
        it('should return a batch by ID', async () => {
            const mockBatch = { id: 1, codeName: 'BATCH001', displayName: 'Test Batch' };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(mockBatch);

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

    describe('GET /api/batches/:id/with-users', () => {
        it('should return a batch with its users', async () => {
            const mockBatch = {
                id: 1,
                codeName: 'BATCH001',
                batchUsers: [{ id: 1, user: { id: 1, name: 'User 1' } }]
            };
            (BatchRepo.findBatchWithUsers as jest.Mock).mockResolvedValue(mockBatch);

            const res = await request(app).get('/api/batches/1/with-users');

            expect(res.status).toBe(200);
            expect(res.body.data.batchUsers).toHaveLength(1);
        });

        it('should return 404 if batch not found', async () => {
            (BatchRepo.findBatchWithUsers as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/batches/999/with-users');

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/batches/course/:courseId', () => {
        it('should return batches for a course', async () => {
            const mockBatches = [
                { id: 1, codeName: 'BATCH001' },
                { id: 2, codeName: 'BATCH002' }
            ];
            (BatchRepo.findBatchesByCourseId as jest.Mock).mockResolvedValue(mockBatches);

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
            const updatedBatch = { id: 1, codeName: 'BATCH001', displayName: 'Updated Batch' };
            (BatchRepo.updateBatch as jest.Mock).mockResolvedValue(updatedBatch);

            const res = await request(app)
                .put('/api/batches/1')
                .send({ displayName: 'Updated Batch' });

            expect(res.status).toBe(200);
            expect(res.body.data.displayName).toBe('Updated Batch');
        });

        it('should return 400 if codeName is empty', async () => {
            const res = await request(app)
                .put('/api/batches/1')
                .send({ codeName: '   ' });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/batches/:id', () => {
        it('should delete a batch', async () => {
            (BatchRepo.deleteBatch as jest.Mock).mockResolvedValue({ id: 1 });

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
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test User' });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 1, codeName: 'BATCH001' });
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
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });

            const res = await request(app)
                .post('/api/batches/add-user')
                .send({ userId: 1, batchId: 1 });

            expect(res.status).toBe(409);
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
            const mockBatchUsers = [{ id: 1, user: { id: 1, name: 'User 1' } }];
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
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });
            (BatchRepo.updateBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1, isActive: false });

            const res = await request(app)
                .put('/api/batches/1/users/1')
                .send({ isActive: false });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Batch user updated successfully');
        });

        it('should return 404 if user is not in batch', async () => {
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .put('/api/batches/1/users/1')
                .send({ isActive: false });

            expect(res.status).toBe(404);
        });
    });
});
