import { Response, NextFunction } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { UserRole } from '@prisma/client';
import { ExamService } from '../services/exam.service';
import { BatchService } from '../services/batch.service';
import { CourseService } from '../services/course.service';
import * as userService from '../services/user.service';
import { ForbiddenError, NotFoundError } from '../errors/api.errors';

const examService = new ExamService();
const batchService = new BatchService();
const courseService = new CourseService();

export const validateIdParam = (paramName: string = 'id') => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const id = Number(req.params[paramName]);
        if (!Number.isInteger(id) || id <= 0) {
            return ApiResponseHandler.badRequest(res, `Invalid ${paramName}: must be a positive integer`);
        }
        next();
    };
};

export const authorizeExamAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id || req.params.examId);

        // Return error if ID is invalid
        if (!id || !Number.isInteger(id)) {
            return ApiResponseHandler.badRequest(res, 'Invalid Exam ID');
        }

        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }

        await examService.validateExamAccess(id, req.user);

        next();
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        if (error instanceof ForbiddenError) {
            return ApiResponseHandler.error(res, error.message, 403);
        }
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};

export const authorizeBatchAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id || req.params.batchId);

        // Return error if ID is invalid
        if (!id || !Number.isInteger(id)) {
            return ApiResponseHandler.badRequest(res, 'Invalid Batch ID');
        }

        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }

        await batchService.validateBatchAccess(id, req.user);

        next();
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        if (error instanceof ForbiddenError) {
            return ApiResponseHandler.error(res, error.message, 403);
        }
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};

export const authorizeCourseAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id || req.params.courseId);

        if (!id || !Number.isInteger(id)) {
            return ApiResponseHandler.badRequest(res, 'Invalid Course ID');
        }

        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }

        await courseService.validateCourseAccess(id, req.user);

        next();
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        if (error instanceof ForbiddenError) {
            return ApiResponseHandler.error(res, error.message, 403);
        }
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};

/**
 * Middleware to authorize access to a user resource.
 * Ensures the requesting user can only access/modify users within their own business.
 * SUPERADMIN can access users across all businesses.
 */
export const authorizeUserAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = Number(req.params.userId || req.params.id);

        if (!userId || !Number.isInteger(userId)) {
            return ApiResponseHandler.badRequest(res, 'Invalid User ID');
        }

        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }

        await userService.validateUserAccess(userId, req.user);

        next();
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        if (error instanceof ForbiddenError) {
            return ApiResponseHandler.error(res, error.message, 403);
        }
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};

/**
 * Middleware to authorize access to business-scoped routes.
 * Ensures the requesting user can only access their own business's resources.
 * SUPERADMIN can access all businesses.
 */
export const authorizeBusinessAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const businessId = Number(req.params.businessId);

        if (!businessId || !Number.isInteger(businessId)) {
            return ApiResponseHandler.badRequest(res, 'Invalid Business ID');
        }

        const isSuperAdmin = req.user?.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = businessId === req.user?.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            return ApiResponseHandler.error(res, 'Forbidden: You do not have access to this business', 403);
        }

        next();
    } catch (error) {
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};
