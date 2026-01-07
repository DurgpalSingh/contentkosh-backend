import { Request, Response } from 'express';
// Use explicit named imports for methods
import { createSubject, getSubject, getSubjectsByCourse, updateSubject, deleteSubject } from '../../../src/controllers/subject.controller';
import { subjectService } from '../../../src/services/subject.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';
import logger from '../../../src/utils/logger';


// Manual mock factory with inline definitions
jest.mock('../../../src/services/subject.service', () => {
    return {
        subjectService: {
            createSubject: jest.fn(),
            getSubject: jest.fn(),
            getSubjectsByCourse: jest.fn(),
            updateSubject: jest.fn(),
            deleteSubject: jest.fn(),
        },
        SubjectService: jest.fn()
    };
});

jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/validation');

describe('Subject Controller', () => {
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

    describe('createSubject', () => {
        it('should create a subject successfully', async () => {
            const subjectData = { name: 'Test Subject', courseId: 1, description: 'Test description' };
            req.body = subjectData;
            req.params = { courseId: '1' };

            (subjectService.createSubject as jest.Mock).mockResolvedValue({ id: 1, ...subjectData });

            await createSubject(req as Request, res as Response);

            expect(subjectService.createSubject).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Test Subject',
                courseId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Subject created successfully', 201);
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.body = { courseId: 1 };
            req.params = { courseId: '1' };

            (subjectService.createSubject as jest.Mock).mockRejectedValue(new BadRequestError('Subject name is required'));

            await createSubject(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Subject name is required');
        });

        it('should return 404 if service throws NotFoundError', async () => {
            req.body = { name: 'Test Subject', courseId: 999 };
            req.params = { courseId: '999' };

            // Fix: pass "Course" to produce "Course not found"
            (subjectService.createSubject as jest.Mock).mockRejectedValue(new NotFoundError('Course'));

            await createSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Course not found');
        });
    });

    describe('getSubject', () => {
        it('should get a subject by ID', async () => {
            req.params = { subjectId: '1', courseId: '1' };
            const mockSubject = { id: 1, name: 'Test Subject', courseId: 1 };

            (subjectService.getSubject as jest.Mock).mockResolvedValue(mockSubject);

            await getSubject(req as Request, res as Response);

            expect(subjectService.getSubject).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubject, 'Subject fetched successfully');
        });

        it('should return 404 if subject not found', async () => {
            req.params = { subjectId: '999', courseId: '1' };
            // Fix: pass "Subject" to produce "Subject not found"
            (subjectService.getSubject as jest.Mock).mockRejectedValue(new NotFoundError('Subject'));

            await getSubject(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Subject not found');
        });
    });

    describe('getSubjectsByCourse', () => {
        it('should get subjects for a course', async () => {
            req.params = { courseId: '1' };
            req.query = {};
            const mockSubjects = [{ id: 1, name: 'Subject 1' }, { id: 2, name: 'Subject 2' }];

            (subjectService.getSubjectsByCourse as jest.Mock).mockResolvedValue(mockSubjects);

            await getSubjectsByCourse(req as Request, res as Response);

            expect(subjectService.getSubjectsByCourse).toHaveBeenCalledWith(1, { active: false });
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockSubjects, 'Subjects fetched successfully');
        });
    });

    describe('updateSubject', () => {
        it('should update a subject successfully', async () => {
            req.params = { subjectId: '1', courseId: '1' };
            req.body = { name: 'Updated Subject', description: 'Updated description' };
            const updatedSubject = { id: 1, name: 'Updated Subject', description: 'Updated description' };

            (subjectService.updateSubject as jest.Mock).mockResolvedValue(updatedSubject);

            await updateSubject(req as Request, res as Response);

            expect(subjectService.updateSubject).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedSubject, 'Subject updated successfully');
        });
    });

    describe('deleteSubject', () => {
        it('should delete a subject successfully', async () => {
            req.params = { subjectId: '1', courseId: '1' };

            (subjectService.deleteSubject as jest.Mock).mockResolvedValue(undefined);

            await deleteSubject(req as Request, res as Response);

            expect(subjectService.deleteSubject).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Subject deleted successfully');
        });
    });
});
