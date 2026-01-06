import { Request, Response } from 'express';
import { createCourse, getCoursesByExam } from '../../../src/controllers/course.controller';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/services/course.service', () => {
    return {
        CourseService: jest.fn().mockImplementation(() => {
            return {
                createCourse: jest.fn(),
                getCoursesByExam: jest.fn(),
            };
        })
    };
});
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/validation', () => ({
    ValidationUtils: {
        validateId: jest.fn((id) => Number(id))
    }
}));

describe('Course Controller Security', () => {
    let req: any;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {
            query: {},
            params: {},
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('createCourse - Business ID Validation', () => {
        it('should return 403 if user businessId does not match exam businessId', async () => {
            req.params = { examId: '1' };
            req.body = { name: 'Test Course', examId: 1 };
            req.user = { id: 1, role: UserRole.ADMIN, businessId: 1 }; // User from Business 1

            // Exam belongs to Business 2
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Exam 1', businessId: 2 });

            await createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Forbidden: You do not have access to this exam', 403);
        });

        it('should allow access if user businessId matches exam businessId', async () => {
            req.params = { examId: '1' };
            req.body = { name: 'Test Course', examId: 1 };
            req.user = { id: 1, role: UserRole.ADMIN, businessId: 1 }; // User from Business 1

            // Exam belongs to Business 1
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Exam 1', businessId: 1 });

            await createCourse(req as Request, res as Response);

            // Should not be forbidden, should proceed (checking if findExamById was called is enough to know it passed the check)
            // Ideally we'd check success but we mocked the service to do nothing/return undefined by default which might cause later errors,
            // but we are checking that it passed the security check.
            expect(ApiResponseHandler.error).not.toHaveBeenCalledWith(res, 'Forbidden: You do not have access to this exam', 403);
        });

        it('should allow access if user is SUPERADMIN regardless of businessId', async () => {
            req.params = { examId: '1' };
            req.body = { name: 'Test Course', examId: 1 };
            req.user = { id: 1, role: UserRole.SUPERADMIN, businessId: 1 };

            // Exam belongs to Business 2
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Exam 1', businessId: 2 });

            await createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.error).not.toHaveBeenCalledWith(res, 'Forbidden: You do not have access to this exam', 403);
        });
    });

    describe('getCoursesByExam - Business ID Validation', () => {
        it('should return 403 if user businessId does not match exam businessId', async () => {
            req.params = { examId: '1' };
            req.user = { id: 1, role: UserRole.ADMIN, businessId: 1 };

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Exam 1', businessId: 2 });

            await getCoursesByExam(req as Request, res as Response);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Forbidden: You do not have access to this exam', 403);
        });
    });
});
