import { Request, Response } from 'express';
import * as CourseController from '../../../src/controllers/course.controller';
import { CourseService } from '../../../src/services/course.service';
import { ExamService } from '../../../src/services/exam.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';

// Do NOT mock Service modules directly. Use spyOn.
// Do NOT mock ValidationUtils. Use real implementation where possible, or spy if needed.
// Do NOT mock api.errors. Use real implementation.

// Mock dependencies of ApiResponseHandler and Logger only to avoid noise
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Course Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    // Spies
    let createCourseSpy: jest.SpyInstance;
    let getCourseSpy: jest.SpyInstance;
    let getCoursesByExamSpy: jest.SpyInstance;
    let updateCourseSpy: jest.SpyInstance;
    let deleteCourseSpy: jest.SpyInstance;
    let getExamSpy: jest.SpyInstance;

    beforeEach(() => {
        req = {
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Spy on Service prototype methods
        createCourseSpy = jest.spyOn(CourseService.prototype, 'createCourse');
        getCourseSpy = jest.spyOn(CourseService.prototype, 'getCourse');
        getCoursesByExamSpy = jest.spyOn(CourseService.prototype, 'getCoursesByExam');
        updateCourseSpy = jest.spyOn(CourseService.prototype, 'updateCourse');
        deleteCourseSpy = jest.spyOn(CourseService.prototype, 'deleteCourse');

        // ExamService is used in createCourse and getCoursesByExam
        getExamSpy = jest.spyOn(ExamService.prototype, 'getExam');

        // Mock ValidationUtils.validateId to return the ID as number (simplification)
        jest.spyOn(ValidationUtils, 'validateId').mockImplementation((id) => Number(id));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createCourse', () => {
        const validCourseData = { name: 'Test Course', examId: 1, description: 'Test description' };

        it('should create a course successfully', async () => {
            req.body = validCourseData;
            req.params = { examId: '1' };
            const createdCourse = { id: 1, ...validCourseData };

            getExamSpy.mockResolvedValue({ id: 1, name: 'Test Exam' });
            createCourseSpy.mockResolvedValue(createdCourse as any);

            await CourseController.createCourse(req as Request, res as Response);

            expect(getExamSpy).toHaveBeenCalledWith(1);
            expect(createCourseSpy).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Course',
                examId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, createdCourse, 'Course created successfully', 201);
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.body = { examId: 1 };
            req.params = { examId: '1' };

            getExamSpy.mockResolvedValue({ id: 1 });
            createCourseSpy.mockRejectedValue(new BadRequestError('Course name is required'));

            await CourseController.createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Course name is required');
        });

        it('should return 404 if exam does not exist', async () => {
            req.body = validCourseData;
            req.params = { examId: '999' };

            getExamSpy.mockRejectedValue(new NotFoundError('Exam'));

            await CourseController.createCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
        });
    });

    describe('getCourse', () => {
        it('should get a course by ID', async () => {
            req.params = { courseId: '1', examId: '1' };
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };

            getCourseSpy.mockResolvedValue(mockCourse as any);

            await CourseController.getCourse(req as Request, res as Response);

            expect(getCourseSpy).toHaveBeenCalledWith(1, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourse, 'Course fetched successfully');
        });

        it('should return 404 if course not found', async () => {
            req.params = { courseId: '999', examId: '1' };
            getCourseSpy.mockRejectedValue(new NotFoundError('Course'));

            await CourseController.getCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });

        it('should return 404 if course does not belong to exam', async () => {
            req.params = { courseId: '1', examId: '2' };
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };

            getCourseSpy.mockResolvedValue(mockCourse as any);

            await CourseController.getCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found in this exam');
        });
    });

    describe('getCoursesByExam', () => {
        it('should get courses for an exam', async () => {
            req.params = { examId: '1' };
            req.query = {};
            const mockCourses = [{ id: 1, name: 'Course 1' }];

            getExamSpy.mockResolvedValue({ id: 1 });
            getCoursesByExamSpy.mockResolvedValue(mockCourses as any);

            await CourseController.getCoursesByExam(req as Request, res as Response);

            expect(getCoursesByExamSpy).toHaveBeenCalledWith(1, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockCourses, 'Courses fetched successfully');
        });

        it('should handle active filter', async () => {
            req.params = { examId: '1' };
            req.query = { active: 'true' };

            getExamSpy.mockResolvedValue({ id: 1 });
            getCoursesByExamSpy.mockResolvedValue([]);

            await CourseController.getCoursesByExam(req as Request, res as Response);

            expect(getCoursesByExamSpy).toHaveBeenCalledWith(1, expect.objectContaining({ where: { status: 'ACTIVE' } }));
        });

        it('should return 404 if exam does not exist', async () => {
            req.params = { examId: '999' };
            getExamSpy.mockRejectedValue(new NotFoundError('Exam'));

            await CourseController.getCoursesByExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
        });
    });

    describe('updateCourse', () => {
        it('should update a course successfully', async () => {
            req.params = { courseId: '1', examId: '1' };
            req.body = { name: 'Updated' };
            const updatedCourse = { id: 1, name: 'Updated', examId: 1 };

            // Mock getCourse for the scope check
            getCourseSpy.mockResolvedValue({ id: 1, examId: 1 });
            updateCourseSpy.mockResolvedValue(updatedCourse as any);

            await CourseController.updateCourse(req as Request, res as Response);

            expect(updateCourseSpy).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Updated' }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedCourse, 'Course updated successfully');
        });

        it('should return 404 if course not found in this exam', async () => {
            req.params = { courseId: '1', examId: '2' }; // Mismatch
            getCourseSpy.mockResolvedValue({ id: 1, examId: 1 }); // Belongs to Exam 1

            await CourseController.updateCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found in this exam');
            expect(updateCourseSpy).not.toHaveBeenCalled();
        });

        it('should return 404 if course does not exist (from getCourse)', async () => {
            req.params = { courseId: '999', examId: '1' };
            getCourseSpy.mockRejectedValue(new NotFoundError('Course'));

            await CourseController.updateCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });

        it('should handle BadRequestError', async () => {
            req.params = { courseId: '1', examId: '1' };
            req.body = {}; // invalid? DTO validation might handle this, but checking service error
            getCourseSpy.mockResolvedValue({ id: 1, examId: 1 });
            updateCourseSpy.mockRejectedValue(new BadRequestError('Invalid data'));

            await CourseController.updateCourse(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Invalid data');
        });
    });

    describe('deleteCourse', () => {
        it('should delete a course successfully', async () => {
            req.params = { courseId: '1', examId: '1' };

            getCourseSpy.mockResolvedValue({ id: 1, examId: 1 });
            deleteCourseSpy.mockResolvedValue(undefined);

            await CourseController.deleteCourse(req as Request, res as Response);

            expect(deleteCourseSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Course deleted successfully');
        });

        it('should return 404 if course not found in this exam', async () => {
            req.params = { courseId: '1', examId: '2' };
            getCourseSpy.mockResolvedValue({ id: 1, examId: 1 });

            await CourseController.deleteCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found in this exam');
            expect(deleteCourseSpy).not.toHaveBeenCalled();
        });

        it('should return 404 if course does not exist', async () => {
            req.params = { courseId: '999', examId: '1' };
            getCourseSpy.mockRejectedValue(new NotFoundError('Course'));

            await CourseController.deleteCourse(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });
    });
});
