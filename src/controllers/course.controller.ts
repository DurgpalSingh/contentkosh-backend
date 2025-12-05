import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as courseRepo from '../repositories/course.repo';
import * as examRepo from '../repositories/exam.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';

export const createCourse = async (req: Request, res: Response) => {
    const courseData: Prisma.CourseUncheckedCreateInput = req.body;

    // Validate input
    if (!courseData.name) {
      throw new BadRequestError('Course name is required');
    }

    if (!courseData.examId) {
        throw new BadRequestError('Exam ID is required');
    }

    const exam = await examRepo.findExamById(courseData.examId);
    if (!exam) {
        throw new NotFoundError('Exam not found');
    }

    const course = await courseRepo.createCourse({
        ...courseData,
        exam: {
            connect: {
                id: courseData.examId
            }
        }
    });
    
    logger.info(`Course created successfully: ${courseData.name}`);

    ApiResponseHandler.success(res, course, 'Course created successfully', 201);
};

function getCourseIdFromRequest(req: Request): number {
    const id = Number(req.params.courseId);
    if (Number.isInteger(id) && id > 0) {
        return id;
    }
    throw new BadRequestError('Course ID is required');
}

export const getCourse = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);

    const course = await courseRepo.findCourseById(id);
    if (!course) {
        throw new NotFoundError('Course not found');
    }

    logger.info(`Course fetched successfully: ${course.name}`);

    ApiResponseHandler.success(res, course, 'Course fetched successfully');
};

export const getCourseWithSubjects = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);
    
    const course = await courseRepo.findCourseWithSubjects(id);
    if (!course) {
        throw new NotFoundError('Course not found');
    }
    
    logger.info(`Course with subjects fetched successfully: ${course.name}`);

    ApiResponseHandler.success(res, course, 'Course with subjects fetched successfully');
};

export const getCoursesByExam = async (req: Request, res: Response) => {
    const examId = Number(req.params.examId);
    if (!Number.isInteger(examId) || examId <= 0) {
        throw new BadRequestError('Valid Exam ID is required');
    }

    const activeOnly = req.query.active === 'true';
    const courses = await courseRepo.findCoursesByExamId(examId);
    
    logger.info(`Courses fetched for exam ${examId}`);

    ApiResponseHandler.success(res, courses, 'Courses fetched successfully');
};

export const updateCourse = async (req: Request, res: Response) => {
    const id = getCourseIdFromRequest(req);
    const courseData: Prisma.CourseUncheckedUpdateInput = req.body;

    // Validate input
    if (courseData.name !== undefined && typeof courseData.name === 'string' && !courseData.name.trim()) {
      throw new BadRequestError('Course name cannot be empty');
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
export const getCoursesByBusiness = async (req: Request, res: Response) => {
    const businessId = Number(req.params.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) {
        throw new BadRequestError('Valid Business ID is required');
    }

    const activeOnly = req.query.active === 'true';

    let courses;
    if (activeOnly) {
        courses = await courseRepo.findActiveCoursesByBusinessId(businessId);
    } else {
        courses = await courseRepo.findCoursesByBusinessId(businessId);
    }

    logger.info(`Courses fetched for business ${businessId}`);

    ApiResponseHandler.success(res, courses, 'Courses fetched successfully');
};
