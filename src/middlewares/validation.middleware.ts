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

export const authorizeBatchAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const id = Number(req.params.id || req.params.batchId);

        // Return error if ID is invalid
        if (!id || !Number.isInteger(id)) {
            return ApiResponseHandler.badRequest(res, 'Invalid Batch ID');
        }

        // We need to fetch the batch and its hierarchy to check businessId
        // Assuming we can access the repo or use prisma directly.
        // Importing prisma here might be circular if not careful, but usually repositories use config/database.
        // Let's import batchRepo.
        const { findBatchById } = await import('../repositories/batch.repo'); // Dynamic import to avoid potential circular deps if needed, or just standard import at top. Standard import is better if possible.

        const batch = await findBatchById(id);
        if (!batch) return ApiResponseHandler.notFound(res, 'Batch not found');

        // Batch -> Course -> Exam -> Business
        // We need to ensure findBatchById returns the course. It does based on my refactor (includes course).
        // But course needs to include exam or businessId. 
        // My batchRepo.findBatchById includes 'course'. 
        // does course include 'examId'? Yes. 
        // Does it include businessId directly? No, usually businessId is on Exam or Course? 
        // In Course Service/Repo, course has `examId`. Exam has `businessId`.
        // So Batch -> Course -> Exam -> Business.
        // Refactored BatchRepo selects course: {id, name, examId}.
        // We need to fetch Exam to get BusinessId.

        const { findExamById } = await import('../repositories/exam.repo');
        // @ts-ignore - course is included
        const examId = batch.course?.examId;

        if (!examId) {
            // Should not happen if data integrity is good
            return ApiResponseHandler.error(res, 'Batch course has no exam link', 500);
        }

        const exam = await findExamById(examId); // This returns Exam with businessId
        if (!exam) return ApiResponseHandler.error(res, 'Associated exam not found', 500);

        const isSuperAdmin = req.user?.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === req.user?.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            return ApiResponseHandler.error(res, 'Forbidden: You do not have access to this batch', 403);
        }

        next();
    } catch (error) {
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

        const { findCourseById } = await import('../repositories/course.repo');
        const course = await findCourseById(id);

        if (!course) return ApiResponseHandler.notFound(res, 'Course not found');

        // Course -> Exam -> Business
        // @ts-ignore
        const examId = course.examId;

        if (!examId) return ApiResponseHandler.error(res, 'Course has no exam link', 500);

        const { findExamById } = await import('../repositories/exam.repo');
        const exam = await findExamById(examId);

        if (!exam) return ApiResponseHandler.error(res, 'Associated exam not found', 500);

        const isSuperAdmin = req.user?.role === UserRole.SUPERADMIN;
        const hasBusinessAccess = exam.businessId === req.user?.businessId;

        if (!isSuperAdmin && !hasBusinessAccess) {
            return ApiResponseHandler.error(res, 'Forbidden: You do not have access to this course', 403);
        }

        next();
    } catch (error) {
        console.error('Authorization error:', error);
        ApiResponseHandler.error(res, 'Internal server error during authorization');
    }
};
