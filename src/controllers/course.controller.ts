import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as examRepo from '../repositories/exam.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { CreateCourseDto, UpdateCourseDto } from '../dtos/course.dto';
import { plainToInstance } from 'class-transformer';
import { QueryBuilder } from '../utils/queryBuilder';
import { CourseService } from '../services/course.service';

export const courseService = new CourseService();

export const createCourse = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');

        const courseDataInput = plainToInstance(CreateCourseDto, req.body);
        courseDataInput.examId = examId;

        // Validate Exam ID existence
        const exam = await examRepo.findExamById(examId);
        if (!exam) {
            logger.error(`Exam with ID ${examId} not found`);
            return ApiResponseHandler.notFound(res, `Exam with ID ${examId} not found`);
        }

        const course = await courseService.createCourse(courseDataInput);

        ApiResponseHandler.success(res, course, 'Course created successfully', 201);
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error creating course: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to create course');
    }
};

function getCourseIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.courseId, 'Course ID');
}

export const getCourse = async (req: Request, res: Response) => {
    try {
        const id = getCourseIdFromRequest(req);
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const options = QueryBuilder.parse(req.query);

        const course = await courseService.getCourse(id, options);

        // Strict Check: Ensure course belongs to the exam in the URL
        if (course.examId !== examId) {
            return ApiResponseHandler.notFound(res, 'Course not found in this exam');
        }

        ApiResponseHandler.success(res, course, 'Course fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error fetching course: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch course');
    }
};

export const getCoursesByExam = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const options = QueryBuilder.parse(req.query);

        // Legacy support lookup for active param or status
        if (req.query.active === 'true' && !options.where) {
            // If active=true, we filter by status ACTIVE.
            // But we should use new enum. 'ACTIVE'.
            // Assuming status enum is string 'ACTIVE'.
            options.where = { status: 'ACTIVE' };
        }

        // Validate Exam ID existence
        const exam = await examRepo.findExamById(examId);
        if (!exam) {
            return ApiResponseHandler.notFound(res, `Exam with ID ${examId} not found`);
        }

        const courses = await courseService.getCoursesByExam(examId, options);

        ApiResponseHandler.success(res, courses, 'Courses fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        logger.error(`Error fetching courses by exam: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to fetch courses');
    }
};

export const updateCourse = async (req: Request, res: Response) => {
    try {
        const id = getCourseIdFromRequest(req);
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const courseDataInput: UpdateCourseDto = req.body;

        // Check existence and scope
        const existingCourse = await courseService.getCourse(id);
        if (existingCourse.examId !== examId) {
            return ApiResponseHandler.notFound(res, 'Course not found in this exam');
        }

        const course = await courseService.updateCourse(id, courseDataInput);

        ApiResponseHandler.success(res, course, 'Course updated successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error updating course: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to update course');
    }
};

export const deleteCourse = async (req: Request, res: Response) => {
    try {
        const id = getCourseIdFromRequest(req);
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');

        // Check existence and scope
        const existingCourse = await courseService.getCourse(id);
        if (existingCourse.examId !== examId) {
            return ApiResponseHandler.notFound(res, 'Course not found in this exam');
        }

        await courseService.deleteCourse(id);

        ApiResponseHandler.success(res, null, 'Course deleted successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
            return ApiResponseHandler.badRequest(res, error.message);
        }
        if (error instanceof NotFoundError || error.constructor.name === 'NotFoundError') {
            return ApiResponseHandler.notFound(res, error.message);
        }
        logger.error(`Error deleting course: ${error.message}`);
        ApiResponseHandler.error(res, 'Failed to delete course');
    }
};
