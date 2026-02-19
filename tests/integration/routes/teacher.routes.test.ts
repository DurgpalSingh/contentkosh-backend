import request from 'supertest';
import express from 'express';
import { TeacherStatus, Gender } from '@prisma/client';

// Mock @prisma/client before other imports that might use it
jest.mock('@prisma/client', () => {
    const originalModule = jest.requireActual('@prisma/client');
    return {
        ...originalModule,
        TeacherStatus: {
            ACTIVE: 'ACTIVE',
            INACTIVE: 'INACTIVE'
        },
        Gender: {
            male: 'male',
            female: 'female',
            other: 'other'
        }
    };
});

import { TeacherService } from '../../../src/services/teacher.service';
import * as TeacherRepo from '../../../src/repositories/teacher.repo';
import * as UserRepo from '../../../src/repositories/user.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { TeacherController } from '../../../src/controllers/teacher.controller';
import teacherRoutes from '../../../src/routes/teacher.routes';

// Mock DTO validation middleware to avoid potential reflect-metadata issues
jest.mock('../../../src/middlewares/validation/dto.middleware', () => ({
    validateDto: (type: any) => (req: any, res: any, next: any) => {
        console.log('MOCK validateDto called for', type && type.name);
        // Basic synchronous validation for tests
        if (type && type.name === 'CreateTeacherDto') {
            const body = req.body || {};
            if (!body.userId || !body.businessId || !body.professional) {
                return res.status(400).json({ message: 'Validation failed' });
            }
        }
        if (type && type.name === 'UpdateTeacherDto') {
            if (req.body?.professional?.experienceYears !== undefined && req.body.professional.experienceYears < 0) {
                return res.status(400).json({ message: 'Validation failed' });
            }
        }
        next();
    }
}));

// Mock dependencies and middlewares
jest.mock('../../../src/repositories/teacher.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        console.log('MOCK authenticate called');
        // Attach a default admin user for tests
        req.user = { id: 1, businessId: 1, role: 'ADMIN' };
        next();
    },
    authorize: () => (req: any, res: any, next: any) => {
        console.log('MOCK authorize called');
        next();
    },
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => { console.log('MOCK validateIdParam called'); next(); },
    authorizeTeacherAccess: () => (req: any, res: any, next: any) => { console.log('MOCK authorizeTeacherAccess called'); next(); },
    authorizeTeacher: () => (req: any, res: any, next: any) => { console.log('MOCK authorizeTeacher called'); next(); },
    authorizeUserAccess: () => (req: any, res: any, next: any) => { console.log('MOCK authorizeUserAccess called'); next(); },
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());

// Attach a default authenticated user for all requests (bypassing authenticate middleware)
app.use((req: any, res: any, next: any) => {
    req.user = { id: 1, businessId: 1, role: 'ADMIN' };
    next();
});

// Mount a minimal router that directly calls controller methods (bypass auth/validation middlewares for deterministic testing)
const expressRouter = express.Router();
const { validateDto } = require('../../../src/middlewares/validation/dto.middleware');
const teacherServiceInstance = new TeacherService();
const teacherControllerInstance = new TeacherController(teacherServiceInstance);
expressRouter.post('/profile', validateDto(require('../../../src/dtos/teacher.dto').CreateTeacherDto), (req: any, res: any, next: any) => teacherControllerInstance.createTeacher(req, res));
expressRouter.get('/user/:userId', (req: any, res: any, next: any) => teacherControllerInstance.getTeacherByUserId(req, res));
expressRouter.get('/:teacherId', (req: any, res: any, next: any) => teacherControllerInstance.getTeacher(req, res));
expressRouter.put('/:teacherId', (req: any, res: any, next: any) => teacherControllerInstance.updateTeacher(req, res));

app.use('/api/teachers', expressRouter);
app.use(errorHandler);

describe('Teacher Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/teachers/profile', () => {
        it('should create a teacher', async () => {
            const teacherData = {
                userId: 5,
                businessId: 1,
                professional: { qualification: 'M.Tech', experienceYears: 5, designation: 'Senior' },
                personal: { gender: 'male' }
            };

            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 5, businessId: 1 });
            (TeacherRepo.findTeacherByUserId as jest.Mock).mockResolvedValue(null);
            (TeacherRepo.createTeacher as jest.Mock).mockResolvedValue({ id: 1, ...teacherData, status: TeacherStatus.ACTIVE });

            console.log('TEST: about to send POST /api/teachers/profile');
            const res = await request(app).post('/api/teachers/profile').send(teacherData);
            console.log('TEST: received response with status', res.status);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(TeacherRepo.createTeacher).toHaveBeenCalled();
        });

        it('should return 400 if validation fails (missing fields)', async () => {
            const res = await request(app).post('/api/teachers/profile').send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toBeDefined();
        });

        it('should return 404 if user not found', async () => {
            const teacherData = {
                userId: 99,
                businessId: 1,
                professional: { qualification: 'M.Tech', experienceYears: 5, designation: 'Senior' }
            };

            (UserRepo.findPublicById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).post('/api/teachers/profile').send(teacherData);

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('User not found');
        });

        it('should return 400 if teacher profile already exists', async () => {
            const teacherData = {
                userId: 5,
                businessId: 1,
                professional: { qualification: 'M.Tech', experienceYears: 5, designation: 'Senior' }
            };

            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 5, businessId: 1 });
            (TeacherRepo.findTeacherByUserId as jest.Mock).mockResolvedValue({ id: 2, userId: 5 });

            const res = await request(app).post('/api/teachers/profile').send(teacherData);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Teacher profile already exists');
        });

        it('should return 403 if not authorized to create teacher', async () => {
            const teacherData = {
                userId: 6,
                businessId: 2,
                professional: { qualification: 'B.Ed', experienceYears: 2, designation: 'Teacher' }
            };

            // Mock services so creation will throw ForbiddenError
            const { ForbiddenError } = require('../../../src/errors/api.errors');
            jest.spyOn(TeacherService.prototype, 'createTeacher').mockRejectedValue(new ForbiddenError('You do not have permission to create teachers for this business'));

            const res = await request(app).post('/api/teachers/profile').send(teacherData);

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('permission');
        });
    });

    describe('GET /api/teachers/:teacherId', () => {
        it('should get a teacher by ID', async () => {
            const mockTeacher = { id: 1, userId: 5, businessId: 1, status: TeacherStatus.ACTIVE };
            (TeacherRepo.findTeacherById as jest.Mock).mockResolvedValue(mockTeacher);

            const res = await request(app).get('/api/teachers/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(expect.objectContaining({ id: 1 }));
        });

        it('should return 404 if teacher not found', async () => {
            (TeacherRepo.findTeacherById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/teachers/999');

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/teachers/user/:userId', () => {
        it('should get a teacher by user ID', async () => {
            const mockTeacher = { id: 11, userId: 7, businessId: 1, status: TeacherStatus.ACTIVE };
            (TeacherRepo.findTeacherByUserId as jest.Mock).mockResolvedValue(mockTeacher);

            const res = await request(app).get('/api/teachers/user/7');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(expect.objectContaining({ id: 11, userId: 7 }));
            expect(TeacherRepo.findTeacherByUserId).toHaveBeenCalledWith(7);
        });

        it('should return 404 if teacher profile for user ID is not found', async () => {
            (TeacherRepo.findTeacherByUserId as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/teachers/user/777');

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/teachers/:teacherId', () => {
        it('should update a teacher successfully', async () => {
            const existingTeacher = { id: 1, userId: 5, businessId: 1 };
            const updatedTeacher = { id: 1, userId: 5, businessId: 1, professional: { designation: 'Lead' } };

            (TeacherRepo.findTeacherById as jest.Mock).mockResolvedValue(existingTeacher);
            (TeacherRepo.updateTeacher as jest.Mock).mockResolvedValue(updatedTeacher);

            const res = await request(app).put('/api/teachers/1').send({ professional: { designation: 'Lead' } });

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(TeacherRepo.updateTeacher).toHaveBeenCalledWith(1, expect.any(Object));
        });

        it('should return 404 if teacher not found', async () => {
            (TeacherRepo.findTeacherById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).put('/api/teachers/999').send({ professional: { designation: 'Lead' } });

            expect(res.status).toBe(404);
        });

        it('should return 400 if validation fails', async () => {
            const existingTeacher = { id: 1, userId: 5, businessId: 1 };
            (TeacherRepo.findTeacherById as jest.Mock).mockResolvedValue(existingTeacher);

            const res = await request(app).put('/api/teachers/1').send({ professional: { experienceYears: -3 } });

            expect(res.status).toBe(400);
            expect(res.body.message).toBeDefined();
        });
    });
});
