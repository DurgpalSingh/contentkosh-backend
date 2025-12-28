import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as examRepo from '../repositories/exam.repo';
import * as businessRepo from '../repositories/business.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';
import { ValidationUtils } from '../utils/validation';
import { CreateExamDto, UpdateExamDto } from '../dtos/exam.dto';
import { QueryBuilder } from '../utils/queryBuilder';

export const createExam = async (req: Request, res: Response) => {
    try {
        const businessIdFromParams = req.params.businessId ? Number(req.params.businessId) : null;
        const examDataInput = req.body;

        // Ensure businessId is consistent
        if (businessIdFromParams && examDataInput.businessId && Number(examDataInput.businessId) !== businessIdFromParams) {
            return ApiResponseHandler.badRequest(res, 'Business ID in path and body do not match');
        }

        const businessId = businessIdFromParams || Number(examDataInput.businessId);

        logger.info('Creating new exam', { name: examDataInput.name, businessId });

        // Validate input
        ValidationUtils.validateNonEmptyString(examDataInput.name, 'Exam name');
        ValidationUtils.validateMaxLength(examDataInput.name, 50, 'Exam name');
        ValidationUtils.validateRequired(businessId, 'Business ID');

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(businessId);
        if (!business) {
            logger.error(`Business with ID ${businessId} not found`);
            return ApiResponseHandler.notFound(res, `Business with ID ${businessId} not found`);
        }

        // Validate duplicates (prisma will handle constraint, but good for explicit error)
        // Leaving it to prisma constraint for now to avoid race conditions

        const createData: Prisma.ExamUncheckedCreateInput = {
            name: examDataInput.name,
            code: examDataInput.code,
            description: examDataInput.description,
            startDate: examDataInput.startDate,
            endDate: examDataInput.endDate,
            businessId: businessId,
            createdBy: (req as any).user?.id // Assuming auth middleware populates user
        } as any; // Cast to any to avoid stale type errors

        const exam = await examRepo.createExam(createData);

        logger.info(`Exam created successfully: ${exam.name}`);

        ApiResponseHandler.success(res, exam, 'Exam created successfully', 201);
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Validation failed: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        // Handle Prisma unique constraint error
        if (error.code === 'P2002') {
            return ApiResponseHandler.badRequest(res, 'Exam with this name already exists for this business');
        }
        logger.error(`Error creating exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to create exam');
    }
};

function getExamIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.id || req.params.examId, 'Exam ID');
}

export const getExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        const options = QueryBuilder.parse(req.query);
        logger.info('Fetching exam', { examId: id });

        const exam = await examRepo.findExamById(id, options);
        if (!exam) {
            logger.error(`Exam with ID ${id} not found`);
            return ApiResponseHandler.notFound(res, 'Exam not found');
        }

        logger.info(`Exam fetched successfully: ${exam.name}`);

        ApiResponseHandler.success(res, exam, 'Exam fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Invalid Exam ID: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error fetching exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch exam');
    }
};



export const getExamsByBusiness = async (req: Request, res: Response) => {
    try {
        const businessId = ValidationUtils.validateId(req.params.businessId || req.query.businessId, 'Business ID');
        const options = QueryBuilder.parse(req.query);
        logger.info('Fetching exams by business', { businessId });

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(businessId);
        if (!business) {
            logger.error(`Business with ID ${businessId} not found`);
            return ApiResponseHandler.notFound(res, `Business with ID ${businessId} not found`);
        }

        const exams = await examRepo.findActiveExamsByBusinessId(businessId, options);

        logger.info(`Fetched ${exams.length} exams for business ${businessId}`);

        ApiResponseHandler.success(res, exams, 'Exams fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Invalid Business ID: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error fetching exams by business: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch exams');
    }
};

export const updateExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        logger.info('Updating exam', { examId: id });

        const examDataInput = req.body;

        // Validate input
        if (examDataInput.name !== undefined) {
            ValidationUtils.validateNonEmptyString(examDataInput.name as string, 'Exam name');
            ValidationUtils.validateMaxLength(examDataInput.name as string, 50, 'Exam name');
        }

        const updateData: Prisma.ExamUncheckedUpdateInput = {
            name: examDataInput.name,
            code: examDataInput.code,
            description: examDataInput.description,
            startDate: examDataInput.startDate,
            endDate: examDataInput.endDate,
            status: examDataInput.status, // Allow status update if provided
            updatedBy: (req as any).user?.id
        } as any; // Cast to any to avoid stale type errors

        const exam = await examRepo.updateExam(id, updateData);

        logger.info(`Exam updated successfully: ${exam.name}`);

        ApiResponseHandler.success(res, exam, 'Exam updated successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Validation failed: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error.code === 'P2002') {
            return ApiResponseHandler.badRequest(res, 'Exam with this name already exists for this business');
        }
        logger.error(`Error updating exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to update exam');
    }
};

export const deleteExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        logger.info('Deleting exam', { examId: id });
        await examRepo.deleteExam(id);
        logger.info(`Exam deleted successfully: ID ${id}`);

        ApiResponseHandler.success(res, null, 'Exam deleted successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Invalid Exam ID: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error deleting exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to delete exam');
    }
};

