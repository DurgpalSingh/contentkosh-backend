import { Request, Response } from 'express';
import * as ExamController from '../../../src/controllers/exam.controller';
import { ExamService } from '../../../src/services/exam.service';
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';
import { AuthRequest } from '../../../src/dtos/auth.dto';

// Use jest.spyOn for ExamService prototype
// Do not mock api.errors or ValidationUtils unless necessary

jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/repositories/business.repo');

describe('Exam Controller', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    // Spies
    let createExamSpy: jest.SpyInstance;
    let getExamSpy: jest.SpyInstance;
    let getExamsByBusinessSpy: jest.SpyInstance;
    let updateExamSpy: jest.SpyInstance;
    let deleteExamSpy: jest.SpyInstance;

    beforeEach(() => {
        req = {
            query: {},
            params: {},
            user: { id: 1, role: 'ADMIN', email: 'test@example.com', businessId: 1 }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Spy on ExamService prototype methods
        createExamSpy = jest.spyOn(ExamService.prototype, 'createExam');
        getExamSpy = jest.spyOn(ExamService.prototype, 'getExam');
        getExamsByBusinessSpy = jest.spyOn(ExamService.prototype, 'getExamsByBusiness');
        updateExamSpy = jest.spyOn(ExamService.prototype, 'updateExam');
        deleteExamSpy = jest.spyOn(ExamService.prototype, 'deleteExam');

        // Mock ValidationUtils.validateId to return ID as number
        jest.spyOn(ValidationUtils, 'validateId').mockImplementation((id) => Number(id));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createExam', () => {
        const validExamData = { name: 'Test Exam', businessId: 1 };

        it('should create an exam successfully', async () => {
            req.params = { businessId: '1' };
            req.body = validExamData;
            const createdExam = { id: 1, ...validExamData };

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            createExamSpy.mockResolvedValue(createdExam as any);

            await ExamController.createExam(req as Request, res as Response);

            expect(createExamSpy).toHaveBeenCalledWith(expect.objectContaining(validExamData), 1); // 1 is userId
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, createdExam, 'Exam created successfully', 201);
        });

        it('should return 400 if business ID is missing in params', async () => {
            req.params = {}; // No businessId
            req.body = validExamData;

            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Business ID is required in path parameters');
        });

        it('should return 404 if business does not exist', async () => {
            req.params = { businessId: '999' };
            req.body = { ...validExamData, businessId: 999 };

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, expect.stringContaining('Business with ID 999 not found'));
        });

        it('should return 401 if user is not authenticated', async () => {
            req.params = { businessId: '1' };
            req.body = validExamData;
            delete req.user;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });

            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.unauthorized).toHaveBeenCalledWith(res, 'User not authenticated');
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.params = { businessId: '1' };
            req.body = validExamData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            createExamSpy.mockRejectedValue(new BadRequestError('Exam exists'));

            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Exam exists');
        });
    });

    describe('getExam', () => {
        it('should get an exam by ID', async () => {
            req.params = { id: '1', businessId: '1' };
            const mockExam = { id: 1, name: 'Test Exam', businessId: 1 };

            getExamSpy.mockResolvedValue(mockExam as any);

            await ExamController.getExam(req as Request, res as Response);

            expect(getExamSpy).toHaveBeenCalledWith(1, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExam, 'Exam fetched successfully');
        });

        it('should return 404 if exam belongs to another business', async () => {
            req.params = { id: '1', businessId: '1' };
            const mockExam = { id: 1, name: 'Test Exam', businessId: 2 }; // different business

            getExamSpy.mockResolvedValue(mockExam as any);

            await ExamController.getExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found in this business');
        });

        it('should return 404 if exam not found', async () => {
            req.params = { id: '999', businessId: '1' };
            getExamSpy.mockRejectedValue(new NotFoundError('Exam'));

            await ExamController.getExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
        });
    });

    describe('getExamsByBusiness', () => {
        it('should get exams for a business', async () => {
            req.params = { businessId: '1' };
            const mockExams = [{ id: 1, name: 'Exam 1' }];

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            getExamsByBusinessSpy.mockResolvedValue(mockExams as any);

            await ExamController.getExamsByBusiness(req as Request, res as Response);

            expect(getExamsByBusinessSpy).toHaveBeenCalledWith(1, req.user, expect.anything());
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExams, 'Exams fetched successfully');
        });

        it('should return 404 if business does not exist', async () => {
            req.params = { businessId: '999' };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await ExamController.getExamsByBusiness(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Business with ID 999 not found');
        });
    });

    describe('updateExam', () => {
        it('should update an exam successfully', async () => {
            req.params = { id: '1', businessId: '1' };
            req.body = { name: 'Updated Exam' };
            const updatedExam = { id: 1, name: 'Updated Exam', businessId: 1 };

            // Mock getExam for scope check
            getExamSpy.mockResolvedValue({ id: 1, businessId: 1 });
            updateExamSpy.mockResolvedValue(updatedExam as any);

            await ExamController.updateExam(req as Request, res as Response);

            expect(updateExamSpy).toHaveBeenCalledWith(1, req.body, 1, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedExam, 'Exam updated successfully');
        });

        it('should return 404 if exam not found in this business', async () => {
            req.params = { id: '1', businessId: '2' }; // mismatch
            getExamSpy.mockResolvedValue({ id: 1, businessId: 1 });

            await ExamController.updateExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found in this business');
            expect(updateExamSpy).not.toHaveBeenCalled();
        });

        it('should return 404 if exam does not exist', async () => {
            req.params = { id: '999', businessId: '1' };
            getExamSpy.mockRejectedValue(new NotFoundError('Exam'));

            await ExamController.updateExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
        });

        it('should return 400 if service throws BadRequestError', async () => {
            req.params = { id: '1', businessId: '1' };
            req.body = {};
            getExamSpy.mockResolvedValue({ id: 1, businessId: 1 });
            updateExamSpy.mockRejectedValue(new BadRequestError('Update error'));

            await ExamController.updateExam(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, 'Update error');
        });
    });

    describe('deleteExam', () => {
        it('should delete an exam successfully', async () => {
            req.params = { id: '1', businessId: '1' };

            // Mock check existence
            getExamSpy.mockResolvedValue({ id: 1, businessId: 1 });
            deleteExamSpy.mockResolvedValue({ id: 1 } as any);

            await ExamController.deleteExam(req as Request, res as Response);

            expect(deleteExamSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Exam deleted successfully');
        });

        it('should return 404 if exam not found in this business', async () => {
            req.params = { id: '1', businessId: '2' };
            getExamSpy.mockResolvedValue({ id: 1, businessId: 1 });

            await ExamController.deleteExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found in this business');
        });

        it('should return 404 if exam does not exist', async () => {
            req.params = { id: '999', businessId: '1' };
            getExamSpy.mockRejectedValue(new NotFoundError('Exam'));

            await ExamController.deleteExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
        });
    });
});
