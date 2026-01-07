import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { subjectService } from '../services/subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from '../dtos/subject.dto';
import { plainToInstance } from 'class-transformer';
import { ValidationUtils } from '../utils/validation';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import logger from '../utils/logger';

export const createSubject = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');

        const subjectDataInput = plainToInstance(CreateSubjectDto, req.body);
        subjectDataInput.courseId = courseId; // Assign courseId from params

        const subject = await subjectService.createSubject(subjectDataInput);

        ApiResponseHandler.success(res, subject, 'Subject created successfully', 201);
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error creating subject: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to create subject');
    }
};

export const getSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        const subject = await subjectService.getSubject(id);
        ApiResponseHandler.success(res, subject, 'Subject fetched successfully');
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error fetching subject: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch subject');
    }
};

export const getSubjectsByCourse = async (req: Request, res: Response) => {
    try {
        const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');
        const activeOnly = req.query.active === 'true';

        const subjects = await subjectService.getSubjectsByCourse(courseId, { active: activeOnly });
        ApiResponseHandler.success(res, subjects, 'Subjects fetched successfully');
    } catch (error: any) {
        logger.error(`Error fetching subjects: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch subjects');
    }
};

export const updateSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        const subjectDataInput = plainToInstance(UpdateSubjectDto, req.body);

        const subject = await subjectService.updateSubject(id, subjectDataInput);
        ApiResponseHandler.success(res, subject, 'Subject updated successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error updating subject: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to update subject');
    }
};

export const deleteSubject = async (req: Request, res: Response) => {
    try {
        const id = ValidationUtils.validateId(req.params.subjectId, 'Subject ID');
        await subjectService.deleteSubject(id);
        ApiResponseHandler.success(res, null, 'Subject deleted successfully');
    } catch (error: any) {
        if (error instanceof NotFoundError) {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error deleting subject: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to delete subject');
    }
};
