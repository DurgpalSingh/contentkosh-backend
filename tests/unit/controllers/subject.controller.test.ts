import { Request, Response } from 'express';
import * as SubjectController from '../../../src/controllers/subject.controller';
import * as SubjectRepo from '../../../src/repositories/subject.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Subject Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('createSubject', () => {
        it('should create a subject successfully', async () => {
            const subjectData = { name: 'Test Subject', courseId: 1, description: 'Test description' };
            req.body = subjectData;

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Course' });
            (SubjectRepo.createSubject as jest.Mock).mockResolvedValue({ id: 1, ...subjectData });

            await SubjectController.createSubject(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1);
            expect(SubjectRepo.createSubject).toHaveBeenCalled();
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Subject created successfully', 201);
        });

        it('should throw error if subject name is missing', async () => {
            req.body = { courseId: 1 }; // Missing name

            await expect(SubjectController.createSubject(req as Request, res as Response)).rejects.toThrow('Subject name is required');
        });

        it('should throw error if courseId is missing', async () => {
            req.body = { name: 'Test Subject' }; // Missing courseId

            await expect(SubjectController.createSubject(req as Request, res as Response)).rejects.toThrow('Course ID is required');
        });

        it('should throw error if course does not exist', async () => {
            req.body = { name: 'Test Subject', courseId: 999 };
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            await expect(SubjectController.createSubject(req as Request, res as Response)).rejects.toThrow('Course not found');
        });
    });

    describe('getSubject', () => {
        it('should get a subject by ID', async () => {
            req.params = { subjectId: '1' };
            const mockSubject = { id: 1, name: 'Test Subject', courseId: 1 };

            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(mockSubject);

            await SubjectController.getSubject(req as Request, res as Response);

            expect(SubjectRepo.findSubjectById).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubject, 'Subject fetched successfully');
        });

        it('should throw error if subject not found', async () => {
            req.params = { subjectId: '999' };
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(null);

            await expect(SubjectController.getSubject(req as Request, res as Response)).rejects.toThrow('Subject not found');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { subjectId: 'invalid' };

            await expect(SubjectController.getSubject(req as Request, res as Response)).rejects.toThrow('Subject ID is required');
        });
    });

    describe('getSubjectsByCourse', () => {
        it('should get subjects for a course', async () => {
            req.params = { courseId: '1' };
            req.query = {};
            const mockSubjects = [{ id: 1, name: 'Subject 1' }, { id: 2, name: 'Subject 2' }];

            (SubjectRepo.findSubjectsByCourseId as jest.Mock).mockResolvedValue(mockSubjects);

            await SubjectController.getSubjectsByCourse(req as Request, res as Response);

            expect(SubjectRepo.findSubjectsByCourseId).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubjects, 'Subjects fetched successfully');
        });

        it('should throw error if courseId is invalid', async () => {
            req.params = { courseId: 'invalid' };
            req.query = {};

            await expect(SubjectController.getSubjectsByCourse(req as Request, res as Response)).rejects.toThrow('Valid Course ID is required');
        });
    });

    describe('updateSubject', () => {
        it('should update a subject successfully', async () => {
            req.params = { subjectId: '1' };
            req.body = { name: 'Updated Subject', description: 'Updated description' };
            const updatedSubject = { id: 1, name: 'Updated Subject', description: 'Updated description' };

            (SubjectRepo.updateSubject as jest.Mock).mockResolvedValue(updatedSubject);

            await SubjectController.updateSubject(req as Request, res as Response);

            expect(SubjectRepo.updateSubject).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedSubject, 'Subject updated successfully');
        });

        it('should throw error if name is empty string', async () => {
            req.params = { subjectId: '1' };
            req.body = { name: '   ' }; // Empty/whitespace name

            await expect(SubjectController.updateSubject(req as Request, res as Response)).rejects.toThrow('Subject name cannot be empty');
        });
    });

    describe('deleteSubject', () => {
        it('should delete a subject successfully', async () => {
            req.params = { subjectId: '1' };

            (SubjectRepo.deleteSubject as jest.Mock).mockResolvedValue({ id: 1 });

            await SubjectController.deleteSubject(req as Request, res as Response);

            expect(SubjectRepo.deleteSubject).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Subject deleted successfully');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { subjectId: 'invalid' };

            await expect(SubjectController.deleteSubject(req as Request, res as Response)).rejects.toThrow('Subject ID is required');
        });
    });
});
