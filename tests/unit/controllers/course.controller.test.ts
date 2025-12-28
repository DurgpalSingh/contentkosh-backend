import { Request, Response } from 'express';
import * as CourseController from '../../../src/controllers/course.controller';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

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
    });

    describe('createCourse', () => {
        it('should create a course successfully', async () => {
            const courseData = { name: 'Test Course', examId: 1, description: 'Test description' };
            req.body = courseData;

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Exam' });
            (CourseRepo.createCourse as jest.Mock).mockResolvedValue({ id: 1, ...courseData });

            await CourseController.createCourse(req as Request, res as Response);

            expect(ExamRepo.findExamById).toHaveBeenCalledWith(1);
            expect(CourseRepo.createCourse).toHaveBeenCalled();
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Course created successfully', 201);
        });

        it('should throw error if course name is missing', async () => {
            req.body = { examId: 1 }; // Missing name

            await expect(CourseController.createCourse(req as Request, res as Response)).rejects.toThrow('Course name is required and cannot be empty');
        });

        it('should throw error if examId is missing', async () => {
            req.body = { name: 'Test Course' }; // Missing examId

            await expect(CourseController.createCourse(req as Request, res as Response)).rejects.toThrow('Exam ID is required');
        });

        it('should throw error if exam does not exist', async () => {
            req.body = { name: 'Test Course', examId: 999 };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            await expect(CourseController.createCourse(req as Request, res as Response)).rejects.toThrow('Exam not found');
        });
    });

    describe('getCourse', () => {
        it('should get a course by ID', async () => {
            req.params = { courseId: '1' };
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(mockCourse);

            await CourseController.getCourse(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1, {});
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should get a course with specific fields', async () => {
            req.params = { courseId: '1' };
            req.query = { fields: 'id,name' };
            const mockCourse = { id: 1, name: 'Test Course' };

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(mockCourse);

            await CourseController.getCourse(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1, expect.objectContaining({
                select: expect.objectContaining({ id: true, name: true })
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should get a course with included relations', async () => {
            req.params = { courseId: '1' };
            req.query = { include: 'subjects' };
            const mockCourse = { id: 1, name: 'Test Course', subjects: [] };

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(mockCourse);

            await CourseController.getCourse(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1, expect.objectContaining({
                include: expect.objectContaining({ subjects: true })
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should get a course with sorting', async () => {
            req.params = { courseId: '1' };
            req.query = { sort: 'name:asc' };
            const mockCourse = { id: 1, name: 'Test Course' };

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(mockCourse);

            await CourseController.getCourse(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1, expect.objectContaining({
                orderBy: { name: 'asc' }
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should throw error if course not found', async () => {
            req.params = { courseId: '999' };
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            await expect(CourseController.getCourse(req as Request, res as Response)).rejects.toThrow('Course not found');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { courseId: 'invalid' };

            await expect(CourseController.getCourse(req as Request, res as Response)).rejects.toThrow('Course ID is required and must be a valid positive integer');
        });
    });




    describe('getCoursesByExam', () => {
        it('should get courses for an exam', async () => {
            req.params = { examId: '1' };
            req.query = {};
            const mockCourses = [{ id: 1, name: 'Course 1' }, { id: 2, name: 'Course 2' }];

            (CourseRepo.findCoursesByExamId as jest.Mock).mockResolvedValue(mockCourses);

            await CourseController.getCoursesByExam(req as Request, res as Response);

            expect(CourseRepo.findCoursesByExamId).toHaveBeenCalledWith(1, {});
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourses, 'Courses fetched successfully');
        });

        it('should throw error if examId is invalid', async () => {
            req.params = { examId: 'invalid' };
            req.query = {};

            await expect(CourseController.getCoursesByExam(req as Request, res as Response)).rejects.toThrow('Exam ID is required and must be a valid positive integer');
        });
    });

    describe('updateCourse', () => {
        it('should update a course successfully', async () => {
            req.params = { courseId: '1' };
            req.body = { name: 'Updated Course', description: 'Updated description' };
            const updatedCourse = { id: 1, name: 'Updated Course', description: 'Updated description' };

            (CourseRepo.updateCourse as jest.Mock).mockResolvedValue(updatedCourse);

            await CourseController.updateCourse(req as Request, res as Response);

            expect(CourseRepo.updateCourse).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedCourse, 'Course updated successfully');
        });

        it('should throw error if name is empty string', async () => {
            req.params = { courseId: '1' };
            req.body = { name: '   ' }; // Empty/whitespace name

            await expect(CourseController.updateCourse(req as Request, res as Response)).rejects.toThrow('Course name is required and cannot be empty');
        });
    });

    describe('deleteCourse', () => {
        it('should delete a course successfully', async () => {
            req.params = { courseId: '1' };

            (CourseRepo.deleteCourse as jest.Mock).mockResolvedValue({ id: 1 });

            await CourseController.deleteCourse(req as Request, res as Response);

            expect(CourseRepo.deleteCourse).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Course deleted successfully');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { courseId: 'invalid' };

            await expect(CourseController.deleteCourse(req as Request, res as Response)).rejects.toThrow('Course ID is required and must be a valid positive integer');
        });
    });
});
