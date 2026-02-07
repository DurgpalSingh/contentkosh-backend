import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as businessRepo from '../repositories/business.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { CreateExamDto, UpdateExamDto } from '../dtos/exam.dto';
import { plainToInstance } from 'class-transformer';
import { AuthRequest } from '../dtos/auth.dto';
import { QueryBuilder } from '../utils/queryBuilder';
import { ExamService } from '../services/exam.service';

export const examService = new ExamService();

export const createExam = async (req: Request, res: Response) => {
    try {
        const businessIdFromParams = Number(req.params.businessId);
        if (!businessIdFromParams || isNaN(businessIdFromParams)) {
            return ApiResponseHandler.badRequest(res, 'Business ID is required in path parameters');
        }

        const examDataInput = plainToInstance(CreateExamDto, req.body);
        examDataInput.businessId = businessIdFromParams;

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(businessIdFromParams);
        if (!business) {
            logger.error(`Business with ID ${businessIdFromParams} not found`);
            return ApiResponseHandler.notFound(res, `Business with ID ${businessIdFromParams} not found`);
        }

        const userId = (req as AuthRequest).user?.id;
        if (!userId) {
            return ApiResponseHandler.unauthorized(res, 'User not authenticated');
        }

        const exam = await examService.createExam(examDataInput, userId);

        ApiResponseHandler.success(res, exam, 'Exam created successfully', 201);
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error creating exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to create exam');
    }
};

function getExamIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.id || req.params.examId, 'Exam ID');
}

// Helper to validate business ID from path
const validateBusinessId = (req: Request): number => {
    const businessId = Number(req.params.businessId);
    if (!businessId || isNaN(businessId)) {
        throw new BadRequestError('Business ID is required in path parameters');
    }
    return businessId;
};

export const getExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        const businessId = validateBusinessId(req);
        const options = QueryBuilder.parse(req.query);

        const exam = await examService.getExam(id, options);

        // Strict Check: Ensure exam belongs to the business in the URL
        if (exam.businessId !== businessId) {
            return ApiResponseHandler.notFound(res, 'Exam not found in this business');
        }

        ApiResponseHandler.success(res, exam, 'Exam fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error fetching exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch exam');
    }
};

export const getExamsByBusiness = async (req: Request, res: Response) => {
    try {
        const businessId = validateBusinessId(req);
        console.log('getExamsByBusiness: businessId from params:', req.params.businessId, 'parsed:', businessId);

        const options = QueryBuilder.parse(req.query);

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(businessId);
        if (!business) {
            return ApiResponseHandler.notFound(res, `Business with ID ${businessId} not found`);
        }

        const user = (req as AuthRequest).user;
        if (!user) {
            return ApiResponseHandler.unauthorized(res, 'User not authenticated');
        }

        const exams = await examService.getExamsByBusiness(businessId, user, options);

        ApiResponseHandler.success(res, exams, 'Exams fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error fetching exams by business: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch exams');
    }
};

export const updateExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        const businessId = validateBusinessId(req);
        const examDataInput: UpdateExamDto = req.body;

        // Check existence and scope first (could be optimized into service, but controller enforces URL contract)
        const existingExam = await examService.getExam(id);
        if (existingExam.businessId !== businessId) {
            return ApiResponseHandler.notFound(res, 'Exam not found in this business');
        }

        const userId = (req as AuthRequest).user?.id;
        if (!userId) {
            return ApiResponseHandler.unauthorized(res, 'User not authenticated');
        }

        const exam = await examService.updateExam(id, examDataInput, userId, businessId);

        ApiResponseHandler.success(res, exam, 'Exam updated successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error updating exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to update exam');
    }
};

export const deleteExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        const businessId = validateBusinessId(req);

        // Check existence and scope
        const existingExam = await examService.getExam(id);
        if (existingExam.businessId !== businessId) {
            return ApiResponseHandler.notFound(res, 'Exam not found in this business');
        }

        await examService.deleteExam(id);

        ApiResponseHandler.success(res, null, 'Exam deleted successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error deleting exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to delete exam');
    }
};

