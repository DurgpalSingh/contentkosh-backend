import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as courseRepo from '../repositories/course.repo';
import * as examRepo from '../repositories/exam.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';
import { ValidationUtils } from '../utils/validation';

import { QueryBuilder } from '../utils/queryBuilder';

export const createCourse = async (req: Request, res: Response) => {
    const courseData: Prisma.CourseUncheckedCreateInput = req.body;

    // Validate input
    ValidationUtils.validateNonEmptyString(courseData.name, 'Course name');
    ValidationUtils.validateRequired(courseData.examId, 'Exam ID');

    const exam = await examRepo.findExamById(courseData.examId);
    if (!exam) {
        throw new NotFoundError('Exam not found');
    }

    const createInput: Prisma.CourseCreateInput = {
        name: courseData.name,
        exam: {
            connect: {
                id: courseData.examId
            }
        }
    };

    if (courseData.description !== undefined) {
        createInput.description = courseData.description;
    }
    if (courseData.duration !== undefined) {
        createInput.duration = courseData.duration;
    }
    if (courseData.isActive !== undefined) {
        createInput.isActive = courseData.isActive;
    }

    const course = await courseRepo.createCourse(createInput);

    logger.info(`Course created successfully: ${courseData.name}`);

    ApiResponseHandler.success(res, course, 'Course created successfully', 201);
};

function getCourseIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.courseId, 'Course ID');
}

export const getCourse = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);
    const options = QueryBuilder.parse(req.query);

    const course = await courseRepo.findCourseById(id, options);
    if (!course) {
        throw new NotFoundError('Course not found');
    }

    logger.info(`Course fetched successfully: ${course.name}`);

    ApiResponseHandler.success(res, course, 'Course fetched successfully');
};



export const getCoursesByExam = async (req: Request, res: Response) => {
    const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
    const options = QueryBuilder.parse(req.query);

    // Legacy support for active query param if not using filter in options
    if (req.query.active === 'true' && !options.where) {
        options.where = { isActive: true };
        // We might need to handle this in repo if repo doesn't support generic where yet
        // but course repo has findActiveCoursesByExamId. 
        // Let's stick to existing logic: if active=true, use findActive, else findCourses
        // But wait, findActive also needs options now.
    }

    let courses;
    if (req.query.active === 'true') {
        courses = await courseRepo.findActiveCoursesByExamId(examId, options);
    } else {
        courses = await courseRepo.findCoursesByExamId(examId, options);
    }

    logger.info(`Courses fetched for exam ${examId}`);

    ApiResponseHandler.success(res, courses, 'Courses fetched successfully');
};

export const updateCourse = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);
    const courseData: Prisma.CourseUncheckedUpdateInput = req.body;

    // Validate input
    if (courseData.name !== undefined) {
        ValidationUtils.validateNonEmptyString(courseData.name as string, 'Course name');
    }

    const course = await courseRepo.updateCourse(id, courseData);

    logger.info(`Course updated successfully: ${course.name}`);

    ApiResponseHandler.success(res, course, 'Course updated successfully');
};

export const deleteCourse = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);

    await courseRepo.deleteCourse(id);

    logger.info(`Course deleted successfully: ID ${id}`);

    ApiResponseHandler.success(res, null, 'Course deleted successfully');
};
