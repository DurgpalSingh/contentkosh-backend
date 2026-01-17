import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import userRoutes from '../../../src/routes/user.routes';
import * as UserRepo from '../../../src/repositories/user.repo';
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { AlreadyExistsError } from '../../../src/errors/api.errors';
import logger from '../../../src/utils/logger';
import { UserRole, UserStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 1, businessId: 1, role: 'ADMIN' };
        next();
    },
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
    authorizeUserAccess: (req: any, res: any, next: any) => next(),
    authorizeBusinessAccess: (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
app.use('/api', userRoutes);
app.use(errorHandler);

describe('User Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== CREATE USER ====================

    describe('POST /api/business/:businessId/users', () => {
        const validUserData = {
            name: 'Amit Sharma',
            email: 'amit@contentkosh.com',
            mobile: '9876543210',
            role: 'TEACHER',
            password: 'Temp@123'
        };

        it('should create a user successfully', async () => {
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockResolvedValue({
                id: 1,
                name: 'Amit Sharma',
                email: 'amit@contentkosh.com',
                mobile: '9876543210',
                role: 'TEACHER',
                businessId: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const res = await request(app)
                .post('/api/business/1/users')
                .send(validUserData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.email).toBe('amit@contentkosh.com');
            expect(res.body.message).toContain('User created successfully');
        });

        it('should return 400 if name is missing', async () => {
            const res = await request(app)
                .post('/api/business/1/users')
                .send({ ...validUserData, name: '' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('User name is required');
        });

        it('should return 400 if email is invalid', async () => {
            const res = await request(app)
                .post('/api/business/1/users')
                .send({ ...validUserData, email: 'invalid-email' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Valid email is required');
        });

        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/business/1/users')
                .send({ ...validUserData, password: '123' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Password must be at least 6 characters');
        });

        it('should return 400 if role is invalid', async () => {
            const res = await request(app)
                .post('/api/business/1/users')
                .send({ ...validUserData, role: 'INVALID_ROLE' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Valid role is required');
        });

        it('should return 404 if business not found', async () => {
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/business/999/users')
                .send(validUserData);

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('Business not found');
        });

        it('should return 409 if email already exists', async () => {
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockRejectedValue(new AlreadyExistsError('User with this email already exists'));

            const res = await request(app)
                .post('/api/business/1/users')
                .send(validUserData);

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('email already exists');
        });

        it('should return 409 if mobile already exists', async () => {
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockRejectedValue(new AlreadyExistsError('User with this mobile already exists'));

            const res = await request(app)
                .post('/api/business/1/users')
                .send(validUserData);

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('mobile already exists');
        });

        it('should return 400 if businessId is invalid', async () => {
            const res = await request(app)
                .post('/api/business/invalid/users')
                .send(validUserData);

            expect(res.status).toBe(400);
        });
    });

    // ==================== GET USERS BY BUSINESS ====================

    describe('GET /api/business/:businessId/users', () => {
        it('should return users for a business', async () => {
            const mockUsers = [
                { id: 1, name: 'User 1', email: 'user1@test.com', role: 'TEACHER' },
                { id: 2, name: 'User 2', email: 'user2@test.com', role: 'STUDENT' }
            ];
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.findByBusinessId as jest.Mock).mockResolvedValue(mockUsers);

            const res = await request(app).get('/api/business/1/users');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.message).toContain('Business users fetched successfully');
        });

        it('should filter users by role', async () => {
            const mockUsers = [
                { id: 1, name: 'Teacher 1', email: 'teacher@test.com', role: 'TEACHER' }
            ];
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.findByBusinessId as jest.Mock).mockResolvedValue(mockUsers);

            const res = await request(app).get('/api/business/1/users?role=TEACHER');

            expect(res.status).toBe(200);
            expect(UserRepo.findByBusinessId).toHaveBeenCalledWith(1, 'TEACHER');
        });

        it('should return 404 if business not found', async () => {
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/business/999/users');

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('Business not found');
        });

        it('should return 400 if businessId is invalid', async () => {
            const res = await request(app).get('/api/business/invalid/users');

            expect(res.status).toBe(400);
        });
    });

    // ==================== UPDATE USER ====================

    describe('PUT /api/users/:userId', () => {
        it('should update a user successfully', async () => {
            const updatedUser = {
                id: 1,
                name: 'Updated Name',
                email: 'test@test.com',
                mobile: '1234567890',
                role: 'TEACHER',
                status: 'ACTIVE'
            };
            (UserRepo.exists as jest.Mock).mockResolvedValue(true);
            (UserRepo.updateUser as jest.Mock).mockResolvedValue(updatedUser);

            const res = await request(app)
                .put('/api/users/1')
                .send({ name: 'Updated Name' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Name');
            expect(res.body.message).toContain('User updated successfully');
        });

        it('should update user status', async () => {
            const updatedUser = {
                id: 1,
                name: 'Test User',
                email: 'test@test.com',
                status: 'INACTIVE'
            };
            (UserRepo.exists as jest.Mock).mockResolvedValue(true);
            (UserRepo.updateUser as jest.Mock).mockResolvedValue(updatedUser);

            const res = await request(app)
                .put('/api/users/1')
                .send({ status: 'INACTIVE' });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('INACTIVE');
        });

        it('should return 404 if user not found', async () => {
            (UserRepo.exists as jest.Mock).mockResolvedValue(false);

            const res = await request(app)
                .put('/api/users/999')
                .send({ name: 'Updated Name' });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('User not found');
        });

        it('should return 400 if name is empty string', async () => {
            const res = await request(app)
                .put('/api/users/1')
                .send({ name: '' });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Name cannot be empty');
        });

        it('should return 400 if role is invalid', async () => {
            const res = await request(app)
                .put('/api/users/1')
                .send({ role: 'INVALID_ROLE' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if userId is invalid', async () => {
            const res = await request(app)
                .put('/api/users/invalid')
                .send({ name: 'Test' });

            expect(res.status).toBe(400);
        });
    });

    // ==================== DELETE USER ====================

    describe('DELETE /api/users/:userId', () => {
        it('should soft delete a user successfully', async () => {
            (UserRepo.exists as jest.Mock).mockResolvedValue(true);
            (UserRepo.softDeleteUser as jest.Mock).mockResolvedValue({ id: 1, status: 'INACTIVE' });

            const res = await request(app).delete('/api/users/1');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('User deleted successfully');
        });

        it('should return 404 if user not found', async () => {
            (UserRepo.exists as jest.Mock).mockResolvedValue(false);

            const res = await request(app).delete('/api/users/999');

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('User not found');
        });

        it('should return 400 if userId is invalid', async () => {
            const res = await request(app).delete('/api/users/invalid');

            expect(res.status).toBe(400);
        });
    });
});
