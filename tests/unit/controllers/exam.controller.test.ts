import { Request, Response } from 'express';
import * as ExamController from '../../../src/controllers/exam.controller';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';


// Mock dependencies
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Exam Controller', () => {
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

    describe('createExam', () => {
        it('should create an exam successfully', async () => {
            logger.info('TEST: Starting createExam success test');
            const examData = { name: 'Test Exam', businessId: 1 };
            req.body = examData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.createExam as jest.Mock).mockResolvedValue({ id: 1, ...examData });

            await ExamController.createExam(req as Request, res as Response);

            expect(BusinessRepo.findBusinessById).toHaveBeenCalledWith(1);
            expect(ExamRepo.createExam).toHaveBeenCalledWith(examData);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Exam created successfully', 201);
        });

        it('should return 400 if validation fails', async () => {
            logger.info('TEST: Starting createExam validation failure test');
            const examData = { name: '', businessId: 1 }; // Invalid name
            req.body = examData;

            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, expect.stringContaining('Exam name is required'));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
        });

        it('should return 404 if business does not exist', async () => {
            logger.info('TEST: Starting createExam business not found test');
            const examData = { name: 'Test Exam', businessId: 999 };
            req.body = examData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await ExamController.createExam(req as Request, res as Response);

            expect(BusinessRepo.findBusinessById).toHaveBeenCalledWith(999);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, expect.stringContaining('Business with ID 999 not found'));
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Business with ID 999 not found'));
        });
    });

    describe('getExam', () => {
        it('should get an exam by ID', async () => {
            logger.info('TEST: Starting getExam success test');
            req.params = { id: '1' };
            const mockExam = { id: 1, name: 'Test Exam' };

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            await ExamController.getExam(req as Request, res as Response);

            expect(ExamRepo.findExamById).toHaveBeenCalledWith(1, {});
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExam, 'Exam fetched successfully');
        });

        it('should get an exam with specific fields', async () => {
            req.params = { id: '1' };
            req.query = { fields: 'id,name' };
            const mockExam = { id: 1, name: 'Test Exam' };

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            await ExamController.getExam(req as Request, res as Response);

            expect(ExamRepo.findExamById).toHaveBeenCalledWith(1, expect.objectContaining({
                select: expect.objectContaining({ id: true, name: true })
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExam, 'Exam fetched successfully');
        });

        it('should get an exam with included relations', async () => {
            req.params = { id: '1' };
            req.query = { include: 'courses' };
            const mockExam = { id: 1, name: 'Test Exam', courses: [] };

            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(mockExam);

            await ExamController.getExam(req as Request, res as Response);

            expect(ExamRepo.findExamById).toHaveBeenCalledWith(1, expect.objectContaining({
                include: expect.objectContaining({ courses: true })
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExam, 'Exam fetched successfully');
        });

        it('should return 404 if exam not found', async () => {
            logger.info('TEST: Starting getExam not found test');
            req.params = { id: '999' };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            await ExamController.getExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Exam with ID 999 not found'));
        });

        it('should return 400 if ID is invalid', async () => {
            req.params = { id: 'invalid' };
            await ExamController.getExam(req as Request, res as Response);
            expect(ApiResponseHandler.badRequest).toHaveBeenCalledWith(res, expect.stringContaining('Exam ID is required'));
        });
    });



    describe('getExamsByBusiness', () => {
        it('should get exams for a business', async () => {
            logger.info('TEST: Starting getExamsByBusiness success test');
            req.query = { businessId: '1' };
            const mockExams = [{ id: 1, name: 'Exam 1' }];

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (ExamRepo.findActiveExamsByBusinessId as jest.Mock).mockResolvedValue(mockExams);

            await ExamController.getExamsByBusiness(req as Request, res as Response);

            expect(BusinessRepo.findBusinessById).toHaveBeenCalledWith(1);
            expect(ExamRepo.findActiveExamsByBusinessId).toHaveBeenCalledWith(1, {});
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExams, 'Exams fetched successfully');
        });

        it('should return 404 if business not found', async () => {
            logger.info('TEST: Starting getExamsByBusiness business not found test');
            req.query = { businessId: '999' };
            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await ExamController.getExamsByBusiness(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, expect.stringContaining('Business with ID 999 not found'));
        });
    });

    describe('updateExam', () => {
        it('should update an exam successfully', async () => {
            logger.info('TEST: Starting updateExam success test');
            req.params = { id: '1' };
            req.body = { name: 'Updated Exam' };
            const updatedExam = { id: 1, name: 'Updated Exam' };

            (ExamRepo.updateExam as jest.Mock).mockResolvedValue(updatedExam);

            await ExamController.updateExam(req as Request, res as Response);

            expect(ExamRepo.updateExam).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedExam, 'Exam updated successfully');
        });
    });

    describe('deleteExam', () => {
        it('should delete an exam successfully', async () => {
            logger.info('TEST: Starting deleteExam success test');
            req.params = { id: '1' };

            (ExamRepo.deleteExam as jest.Mock).mockResolvedValue({ id: 1, isActive: false });

            await ExamController.deleteExam(req as Request, res as Response);

            expect(ExamRepo.deleteExam).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Exam deleted successfully');
        });
    });
});
