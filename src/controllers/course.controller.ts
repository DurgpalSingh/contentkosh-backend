import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { ValidationUtils } from '../utils/validation';
import { CreateCourseDto, UpdateCourseDto } from '../dtos/course.dto';
import { plainToInstance } from 'class-transformer';
import { QueryBuilder } from '../utils/queryBuilder';
import { CourseService } from '../services/course.service';
import { ExamService } from '../services/exam.service';
import { handleControllerError } from '../utils/controllerErrorHandler';


export const courseService = new CourseService();
export const examService = new ExamService();

export const createCourse = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');

        const courseDataInput = plainToInstance(CreateCourseDto, req.body);
        courseDataInput.examId = examId;

        // Validate Exam ID existence
        const exam = await examService.getExam(examId);



        const course = await courseService.createCourse(courseDataInput);

        ApiResponseHandler.success(res, course, 'Course created successfully', 201);
    } catch (error) {
        handleControllerError(res, error, 'Failed to create course', 'Error creating course');
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
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch course', 'Error fetching course');
    }
};

export const getCoursesByExam = async (req: Request, res: Response) => {
    try {
        const examId = ValidationUtils.validateId(req.params.examId, 'Exam ID');
        const options = QueryBuilder.parse(req.query);

        // Legacy support lookup for active param or status
        if (req.query.active === 'true' && !options.where) {
            options.where = { status: 'ACTIVE' };
        }

        // Validate Exam ID existence
        const exam = await examService.getExam(examId);



        const user = (req as any).user;
        if (!user) {
            return ApiResponseHandler.unauthorized(res, 'User not authenticated');
        }

        const courses = await courseService.getCoursesByExam(examId, user, options);

        ApiResponseHandler.success(res, courses, 'Courses fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch courses', 'Error fetching courses by exam');
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
    } catch (error) {
        handleControllerError(res, error, 'Failed to update course', 'Error updating course');
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
    } catch (error) {
        handleControllerError(res, error, 'Failed to delete course', 'Error deleting course');
    }
};
