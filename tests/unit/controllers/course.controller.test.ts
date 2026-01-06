import { Request, Response } from 'express';
// Import courseService from CONTROLLER, because Service file doesn't export it
import { courseService, createCourse, getCourse, getCoursesByExam, updateCourse, deleteCourse } from '../../../src/controllers/course.controller';
import * as CourseController from '../../../src/controllers/course.controller';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';
import logger from '../../../src/utils/logger';

// Mock the Service Class
jest.mock('../../../src/services/course.service', () => {
    return {
        CourseService: jest.fn().mockImplementation(() => {
            return {
                createCourse: jest.fn(),
                getCourse: jest.fn(),
                getCoursesByExam: jest.fn(),
                updateCourse: jest.fn(),
                deleteCourse: jest.fn(),
            };
        })
    };
});

jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/validation');

describe('Course Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Default ValidationUtils mock
        (ValidationUtils.validateId as jest.Mock).mockImplementation((id) => Number(id));
    });

    describe('createCourse', () => {
        it('should create a course successfully', async () => {
            const courseData = { name: 'Test Course', examId: 1, description: 'Test description' };
            req.body = courseData;
            req.params = { examId: '1' };

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Exam' });

            (courseService.createCourse as jest.Mock).mockResolvedValue({ id: 1, ...courseData });

            await createCourse(req as Request, res as Response);

            expect(ExamRepo.findExamById).toHaveBeenCalledWith(1);
            expect(courseService.createCourse).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Course',
                examId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Course created successfully', 201);
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.body = { examId: 1 };
            req.params = { examId: '1' };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1 });

            (courseService.createCourse as jest.Mock).mockRejectedValue(new BadRequestError('Course name is required'));

            await createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Course name is required');
        });

        it('should return 404 if exam does not exist', async () => {
            req.body = { name: 'Test Course', examId: 999 };
            req.params = { examId: '999' };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            await createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam with ID 999 not found');
        });
    });

    describe('getCourse', () => {
        it('should get a course by ID', async () => {
            req.params = { courseId: '1', examId: '1' };
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };

            (courseService.getCourse as jest.Mock).mockResolvedValue(mockCourse);

            await getCourse(req as Request, res as Response);

            expect(courseService.getCourse).toHaveBeenCalledWith(1, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should return 404 if course not found', async () => {
            req.params = { courseId: '999', examId: '1' };
            // Corrected: NotFoundError appends " not found", so we pass "Course"
            (courseService.getCourse as jest.Mock).mockRejectedValue(new NotFoundError('Course'));

            await getCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });

        it('should return 404 if course does not belong to exam', async () => {
            req.params = { courseId: '1', examId: '2' };
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };

            (courseService.getCourse as jest.Mock).mockResolvedValue(mockCourse);

            await getCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found in this exam');
        });
    });

    describe('getCoursesByExam', () => {
        it('should get courses for an exam', async () => {
            req.params = { examId: '1' };
            req.query = {};
            const mockCourses = [{ id: 1, name: 'Course 1' }, { id: 2, name: 'Course 2' }];

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1 });
            (courseService.getCoursesByExam as jest.Mock).mockResolvedValue(mockCourses);

            await getCoursesByExam(req as Request, res as Response);

            expect(courseService.getCoursesByExam).toHaveBeenCalledWith(1, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourses, 'Courses fetched successfully');
        });

        it('should return 404 if exam does not exist', async () => {
            req.params = { examId: '999' };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            await getCoursesByExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam with ID 999 not found');
        });
    });

    describe('updateCourse', () => {
        it('should update a course successfully', async () => {
            req.params = { courseId: '1', examId: '1' };
            req.body = { name: 'Updated Course', description: 'Updated description' };
            const updatedCourse = { id: 1, name: 'Updated Course', description: 'Updated description' };

            (courseService.getCourse as jest.Mock).mockResolvedValue({ id: 1, examId: 1 });
            (courseService.updateCourse as jest.Mock).mockResolvedValue(updatedCourse);

            await updateCourse(req as Request, res as Response);

            expect(courseService.updateCourse).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedCourse, 'Course updated successfully');
        });
    });

    describe('deleteCourse', () => {
        it('should delete a course successfully', async () => {
            req.params = { courseId: '1', examId: '1' };

            (courseService.getCourse as jest.Mock).mockResolvedValue({ id: 1, examId: 1 });
            (courseService.deleteCourse as jest.Mock).mockResolvedValue(undefined);

            await deleteCourse(req as Request, res as Response);

            expect(courseService.deleteCourse).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Course deleted successfully');
        });
    });
});
