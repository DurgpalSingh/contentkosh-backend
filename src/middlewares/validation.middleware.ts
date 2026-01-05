import { Response, NextFunction } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { UserRole } from '@prisma/client';
import * as examRepo from '../repositories/exam.repo';

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

        const exam = await examRepo.findExamById(id);
        if (!exam) return ApiResponseHandler.notFound(res, 'Exam not found');

        const isSuperAdmin = req.user?.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === req.user?.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            return ApiResponseHandler.error(res, 'Forbidden: You do not have access to this exam', 403);
        }

        next();
    } catch (error) {
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};
