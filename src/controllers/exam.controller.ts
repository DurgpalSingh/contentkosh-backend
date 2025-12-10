import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as examRepo from '../repositories/exam.repo';
import * as businessRepo from '../repositories/business.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';
import { ValidationUtils } from '../utils/validation';

export const createExam = async (req: Request, res: Response) => {
    try {
        const examData: Prisma.ExamUncheckedCreateInput = req.body;
        logger.info('Creating new exam', { name: examData.name, businessId: examData.businessId });

        // Validate input
        ValidationUtils.validateRequired(examData.name, 'Exam name');
        ValidationUtils.validateMaxLength(examData.name, 50, 'Exam name');
        ValidationUtils.validateRequired(examData.businessId, 'Business ID');

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(Number(examData.businessId));
        if (!business) {
            logger.error(`Business with ID ${examData.businessId} not found`);
            return ApiResponseHandler.notFound(res, `Business with ID ${examData.businessId} not found`);
        }

    const exam = await examRepo.createExam(examData);
    
    logger.info(`Exam created successfully: ${examData.name}`);

        ApiResponseHandler.success(res, exam, 'Exam created successfully', 201);
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Validation failed: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error creating exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to create exam');
    }
};

function getExamIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.id, 'Exam ID');
}

export const getExam = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        logger.info('Fetching exam', { examId: id });

        const exam = await examRepo.findExamById(id);
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

export const getExamWithCourses = async (req: Request, res: Response) => {
    try {
        const id = getExamIdFromRequest(req);
        logger.info('Fetching exam with courses', { examId: id });
        const exam = await examRepo.findExamWithCourses(id);
        if (!exam) {
            logger.error(`Exam with ID ${id} not found`);
            return ApiResponseHandler.notFound(res, 'Exam not found');
        }
        logger.info(`Exam with courses fetched successfully: ${exam.name}`);

        ApiResponseHandler.success(res, exam, 'Exam with courses fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Invalid Exam ID: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error fetching exam with courses: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch exam with courses');
    }
};

export const getExamsByBusiness = async (req: Request, res: Response) => {
    try {
        const businessId = ValidationUtils.validateId(req.query.businessId, 'Business ID');
        logger.info('Fetching exams by business', { businessId });

        // Validate Business ID existence
        const business = await businessRepo.findBusinessById(businessId);
        if (!business) {
            logger.error(`Business with ID ${businessId} not found`);
            return ApiResponseHandler.notFound(res, `Business with ID ${businessId} not found`);
        }

        const exams = await examRepo.findActiveExamsByBusinessId(businessId);

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

        const examData: Prisma.ExamUncheckedUpdateInput = req.body;

        // Validate input
        if (examData.name !== undefined) {
            ValidationUtils.validateRequired(examData.name as string, 'Exam name');
            ValidationUtils.validateMaxLength(examData.name as string, 50, 'Exam name');
        }

    const exam = await examRepo.updateExam(id, examData);
    
    logger.info(`Exam updated successfully: ${exam.name}`);

        ApiResponseHandler.success(res, exam, 'Exam updated successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            logger.error(`Validation failed: ${error.message}`);
            return ApiResponseHandler.badRequest(res, error.message);
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

