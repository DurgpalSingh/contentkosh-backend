import { Request, Response } from 'express';
import { TeacherController } from '../../../src/controllers/teacher.controller';
import { TeacherService } from '../../../src/services/teacher.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';

jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Teacher Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    let createTeacherSpy: jest.SpyInstance;
    let getTeacherSpy: jest.SpyInstance;
    let updateTeacherSpy: jest.SpyInstance;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        createTeacherSpy = jest.spyOn(TeacherService.prototype, 'createTeacher');
        getTeacherSpy = jest.spyOn(TeacherService.prototype, 'getTeacherById');
        updateTeacherSpy = jest.spyOn(TeacherService.prototype, 'updateTeacher');

        jest.spyOn(ValidationUtils, 'validateId').mockImplementation((id: any) => Number(id));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createTeacher', () => {
        const validData = {
            userId: 5,
            businessId: 1,
            professional: {
                qualification: 'M.Sc',
                experienceYears: 3,
                designation: 'Lecturer'
            }
        };

        it('should create a teacher successfully', async () => {
            req.body = validData;
            // Mock req.user
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            const created = { id: 1, ...validData } as any;
            createTeacherSpy.mockResolvedValue(created);

            const controller = new TeacherController(new TeacherService());
            await controller.createTeacher(req as any, res as any);

            expect(createTeacherSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 5, businessId: 1 }), expect.objectContaining({ id: 1 }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.any(Object), 'Teacher profile created successfully', 201);
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.body = validData;
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            createTeacherSpy.mockRejectedValue(new BadRequestError('Invalid data'));

            const controller = new TeacherController(new TeacherService());
            await controller.createTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Invalid data', 400);
        });

        it('should return 404 if service throws NotFoundError', async () => {
            req.body = validData;
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            createTeacherSpy.mockRejectedValue(new NotFoundError('User'));

            const controller = new TeacherController(new TeacherService());
            await controller.createTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'User not found', 404);
        });

        it('should return 403 if service throws ForbiddenError', async () => {
            req.body = validData;
            (req as any).user = { id: 2, businessId: 2, role: 'USER' };

            createTeacherSpy.mockRejectedValue(new ForbiddenError('Not allowed'));

            const controller = new TeacherController(new TeacherService());
            await controller.createTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Not allowed', 403);
        });
    });

    describe('getTeacher', () => {
        it('should get a teacher successfully', async () => {
            req.params = { teacherId: '1' };
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            const mockTeacher = { id: 1, userId: 5, businessId: 1 } as any;
            getTeacherSpy.mockResolvedValue(mockTeacher);

            const controller = new TeacherController(new TeacherService());
            await controller.getTeacher(req as any, res as any);

            expect(getTeacherSpy).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.any(Object), 'Teacher profile fetched successfully');
        });

        it('should return 404 if not found', async () => {
            req.params = { teacherId: '999' };
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            getTeacherSpy.mockRejectedValue(new NotFoundError('Teacher'));

            const controller = new TeacherController(new TeacherService());
            await controller.getTeacher(req as any, res as any);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Teacher not found');
        });

        it('should return 403 if forbidden', async () => {
            req.params = { teacherId: '1' };
            (req as any).user = { id: 3, businessId: 2, role: 'USER' };

            getTeacherSpy.mockRejectedValue(new ForbiddenError('No access'));

            const controller = new TeacherController(new TeacherService());
            await controller.getTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'No access', 403);
        });
    });

    describe('updateTeacher', () => {
        it('should update a teacher successfully', async () => {
            req.params = { teacherId: '1' };
            req.body = { professional: { designation: 'Senior' } };
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            const updated = { id: 1, professional: { designation: 'Senior' } } as any;
            updateTeacherSpy.mockResolvedValue(updated);

            const controller = new TeacherController(new TeacherService());
            await controller.updateTeacher(req as any, res as any);

            expect(updateTeacherSpy).toHaveBeenCalledWith(1, expect.objectContaining({ professional: expect.any(Object) }), expect.objectContaining({ id: 1 }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.any(Object), 'Teacher profile updated successfully');
        });

        it('should return 404 if teacher to update not found', async () => {
            req.params = { teacherId: '999' };
            req.body = { professional: { designation: 'Senior' } };
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            updateTeacherSpy.mockRejectedValue(new NotFoundError('Teacher'));

            const controller = new TeacherController(new TeacherService());
            await controller.updateTeacher(req as any, res as any);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Teacher not found');
        });

        it('should return 400 if validation error', async () => {
            req.params = { teacherId: '1' };
            req.body = { professional: { experienceYears: -5 } };
            (req as any).user = { id: 1, businessId: 1, role: 'ADMIN' };

            updateTeacherSpy.mockRejectedValue(new BadRequestError('Invalid experience years'));

            const controller = new TeacherController(new TeacherService());
            await controller.updateTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Invalid experience years', 400);
        });

        it('should return 403 if forbidden', async () => {
            req.params = { teacherId: '1' };
            req.body = { professional: { designation: 'Senior' } };
            (req as any).user = { id: 4, businessId: 9, role: 'USER' };

            updateTeacherSpy.mockRejectedValue(new ForbiddenError('Not allowed'));

            const controller = new TeacherController(new TeacherService());
            await controller.updateTeacher(req as any, res as any);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Not allowed', 403);
        });
    });
});