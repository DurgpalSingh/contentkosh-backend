import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../src/dtos/auth.dto';
import {
    authorizeExamAccess,
    authorizeBatchAccess,
    authorizeCourseAccess,
    authorizeUserAccess,
    validateIdParam
} from '../../../src/middlewares/validation.middleware';
import { ExamService } from '../../../src/services/exam.service';
import { BatchService } from '../../../src/services/batch.service';
import { CourseService } from '../../../src/services/course.service';
import * as userService from '../../../src/services/user.service';
import { ForbiddenError, NotFoundError } from '../../../src/errors/api.errors';

// Mock dependencies
jest.mock('../../../src/services/exam.service');
jest.mock('../../../src/services/batch.service');
jest.mock('../../../src/services/course.service');
jest.mock('../../../src/services/user.service');

describe('Validation Middleware', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = {
            params: {},
            user: { id: 1, email: 'test@test.com', role: 'USER', businessId: 1 } as any
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    // ================= EXAM ACCESS =================
    describe('authorizeExamAccess', () => {
        it('should call next if validation passes', async () => {
            req.params = { id: '1' };
            const validateSpy = jest.spyOn(ExamService.prototype, 'validateExamAccess').mockResolvedValue();

            await authorizeExamAccess(req as any, res as Response, next);

            expect(validateSpy).toHaveBeenCalledWith(1, req.user);
            expect(next).toHaveBeenCalled();
        });

        it('should return 400 for invalid ID', async () => {
            req.params = { id: 'abc' };
            await authorizeExamAccess(req as any, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 401 if no user attached', async () => {
            req.params = { id: '1' };
            delete req.user;
            await authorizeExamAccess(req as any, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 404 if not found error thrown', async () => {
            req.params = { id: '1' };
            jest.spyOn(ExamService.prototype, 'validateExamAccess').mockRejectedValue(new NotFoundError('Not found'));

            await authorizeExamAccess(req as any, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 if forbidden error thrown', async () => {
            req.params = { id: '1' };
            jest.spyOn(ExamService.prototype, 'validateExamAccess').mockRejectedValue(new ForbiddenError('Forbidden'));

            await authorizeExamAccess(req as any, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });
    });

    // ================= BATCH ACCESS =================
    describe('authorizeBatchAccess', () => {
        it('should call next if validation passes', async () => {
            req.params = { id: '1' };
            const validateSpy = jest.spyOn(BatchService.prototype, 'validateBatchAccess').mockResolvedValue();

            await authorizeBatchAccess(req as any, res as Response, next);

            expect(validateSpy).toHaveBeenCalledWith(1, req.user);
            expect(next).toHaveBeenCalled();
        });

        it('should return 404 if not found error thrown', async () => {
            req.params = { id: '1' };
            jest.spyOn(BatchService.prototype, 'validateBatchAccess').mockRejectedValue(new NotFoundError('Not found'));

            await authorizeBatchAccess(req as any, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    // ================= COURSE ACCESS =================
    describe('authorizeCourseAccess', () => {
        it('should call next if validation passes', async () => {
            req.params = { id: '1' };
            const validateSpy = jest.spyOn(CourseService.prototype, 'validateCourseAccess').mockResolvedValue();

            await authorizeCourseAccess(req as any, res as Response, next);

            expect(validateSpy).toHaveBeenCalledWith(1, req.user);
            expect(next).toHaveBeenCalled();
        });

        it('should return 403 if forbidden param', async () => {
            req.params = { id: '1' };
            jest.spyOn(CourseService.prototype, 'validateCourseAccess').mockRejectedValue(new ForbiddenError('Denied'));

            await authorizeCourseAccess(req as any, res as Response, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    // ================= USER ACCESS =================
    describe('authorizeUserAccess', () => {
        it('should call next if validation passes', async () => {
            req.params = { id: '2' };
            (userService.validateUserAccess as jest.Mock).mockResolvedValue(undefined);

            await authorizeUserAccess(req as any, res as Response, next);

            expect(userService.validateUserAccess).toHaveBeenCalledWith(2, req.user);
            expect(next).toHaveBeenCalled();
        });

        it('should return 400 for invalid user ID', async () => {
            req.params = { userId: 'invalid' };
            await authorizeUserAccess(req as any, res as Response, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});
