import { Request, Response } from 'express';
import * as SubjectController from '../../../src/controllers/subject.controller';
import { SubjectService } from '../../../src/services/subject.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';

// Use jest.spyOn for SubjectService class methods
// Do not mock api.errors or ValidationUtils (unless necessary)

jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Subject Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    // Spies
    let createSubjectSpy: jest.SpyInstance;
    let getSubjectSpy: jest.SpyInstance;
    let getSubjectsByCourseSpy: jest.SpyInstance;
    let updateSubjectSpy: jest.SpyInstance;
    let deleteSubjectSpy: jest.SpyInstance;

    beforeEach(() => {
        req = {
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Spy on SubjectService prototype
        createSubjectSpy = jest.spyOn(SubjectService.prototype, 'createSubject');
        getSubjectSpy = jest.spyOn(SubjectService.prototype, 'getSubject');
        getSubjectsByCourseSpy = jest.spyOn(SubjectService.prototype, 'getSubjectsByCourse');
        updateSubjectSpy = jest.spyOn(SubjectService.prototype, 'updateSubject');
        deleteSubjectSpy = jest.spyOn(SubjectService.prototype, 'deleteSubject');

        // Mock ValidationUtils.validateId to return ID as number
        jest.spyOn(ValidationUtils, 'validateId').mockImplementation((id) => Number(id));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createSubject', () => {
        const validSubjectData = { name: 'Test Subject', courseId: 1, description: 'Test description' };

        it('should create a subject successfully', async () => {
            req.body = validSubjectData;
            req.params = { courseId: '1', examId: '1' };
            const createdSubject = { id: 1, ...validSubjectData };

            createSubjectSpy.mockResolvedValue(createdSubject as any);

            await SubjectController.createSubject(req as Request, res as Response);

            expect(createSubjectSpy).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Subject',
                courseId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, createdSubject, 'Subject created successfully', 201);
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.body = validSubjectData;
            req.params = { courseId: '1' };

            createSubjectSpy.mockRejectedValue(new BadRequestError('Subject name is required'));

            await SubjectController.createSubject(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Subject name is required');
        });

        it('should return 404 if service throws NotFoundError (Course not found)', async () => {
            req.body = validSubjectData;
            req.params = { courseId: '999' };

            createSubjectSpy.mockRejectedValue(new NotFoundError('Course'));

            await SubjectController.createSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });
    });

    describe('getSubject', () => {
        it('should get a subject by ID', async () => {
            req.params = { subjectId: '1', courseId: '1' };
            const mockSubject = { id: 1, name: 'Test Subject', courseId: 1 };

            getSubjectSpy.mockResolvedValue(mockSubject as any);

            await SubjectController.getSubject(req as Request, res as Response);

            expect(getSubjectSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubject, 'Subject fetched successfully');
        });

        it('should return 404 if subject not found', async () => {
            req.params = { subjectId: '999', courseId: '1' };
            getSubjectSpy.mockRejectedValue(new NotFoundError('Subject'));

            await SubjectController.getSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Subject not found');
        });
    });

    describe('getSubjectsByCourse', () => {
        it('should get subjects for a course', async () => {
            req.params = { courseId: '1' };
            req.query = {};
            const mockSubjects = [{ id: 1, name: 'Subject 1' }];

            getSubjectsByCourseSpy.mockResolvedValue(mockSubjects as any);

            await SubjectController.getSubjectsByCourse(req as Request, res as Response);

            expect(getSubjectsByCourseSpy).toHaveBeenCalledWith(1, { active: false });
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubjects, 'Subjects fetched successfully');
        });

        it('should handle active filter', async () => {
            req.params = { courseId: '1' };
            req.query = { active: 'true' };
            const mockSubjects = [{ id: 1, name: 'Active Subject' }];

            getSubjectsByCourseSpy.mockResolvedValue(mockSubjects as any);

            await SubjectController.getSubjectsByCourse(req as Request, res as Response);

            expect(getSubjectsByCourseSpy).toHaveBeenCalledWith(1, { active: true });
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubjects, 'Subjects fetched successfully');
        });
    });

    describe('updateSubject', () => {
        it('should update a subject successfully', async () => {
            req.params = { subjectId: '1', courseId: '1' };
            req.body = { name: 'Updated Subject' };
            const updatedSubject = { id: 1, name: 'Updated Subject' };

            updateSubjectSpy.mockResolvedValue(updatedSubject as any);

            await SubjectController.updateSubject(req as Request, res as Response);

            expect(updateSubjectSpy).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Updated Subject' }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedSubject, 'Subject updated successfully');
        });

        it('should return 404 if subject not found', async () => {
            req.params = { subjectId: '999' };
            req.body = { name: 'Updated' };
            updateSubjectSpy.mockRejectedValue(new NotFoundError('Subject'));

            await SubjectController.updateSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Subject not found');
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.params = { subjectId: '1' };
            req.body = { name: 'Duplicate' };
            updateSubjectSpy.mockRejectedValue(new BadRequestError('Duplicate name'));

            await SubjectController.updateSubject(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Duplicate name');
        });
    });

    describe('deleteSubject', () => {
        it('should delete a subject successfully', async () => {
            req.params = { subjectId: '1', courseId: '1' };
            deleteSubjectSpy.mockResolvedValue(undefined);

            await SubjectController.deleteSubject(req as Request, res as Response);

            expect(deleteSubjectSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Subject deleted successfully');
        });

        it('should return 404 if subject not found', async () => {
            req.params = { subjectId: '999' };
            deleteSubjectSpy.mockRejectedValue(new NotFoundError('Subject'));

            await SubjectController.deleteSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Subject not found');
        });
    });
});
