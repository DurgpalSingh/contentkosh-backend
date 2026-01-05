import { Request, Response } from 'express';
import * as ExamController from '../../../src/controllers/exam.controller';
import { examService } from '../../../src/controllers/exam.controller'; // Import the instance
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';
import { ExamService } from '../../../src/services/exam.service';
import { AuthRequest } from '../../../src/dtos/auth.dto';
import { NotFoundError } from '../../../src/errors/api.errors';

// Mock dependencies
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

// Auto-mock the service class so 'new ExamService()' returns a mock object
jest.mock('../../../src/services/exam.service');

describe('Exam Controller', () => {
    let req: Partial<AuthRequest>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {
            query: {},
            params: {},
            user: { id: 1, role: 'ADMIN', email: 'test@example.com', name: 'Tester', businessId: 1 }
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
            req.params = { businessId: '1' }; // Path param
            const examData = { name: 'Test Exam', businessId: 1 };
            req.body = examData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            // Mock the method on the exported instance
            (examService.createExam as jest.Mock).mockResolvedValue({ id: 1, ...examData });

            await ExamController.createExam(req as Request, res as Response);

            expect(BusinessRepo.findBusinessById).toHaveBeenCalledWith(1);
            expect(examService.createExam).toHaveBeenCalledWith(expect.objectContaining(examData), 1); // 1 is userId
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Exam created successfully', 201);
        });

        it('should return 404 if business does not exist', async () => {
            logger.info('TEST: Starting createExam business not found test');
            req.params = { businessId: '999' };
            const examData = { name: 'Test Exam', businessId: 999 };
            req.body = examData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await ExamController.createExam(req as Request, res as Response);

            expect(BusinessRepo.findBusinessById).toHaveBeenCalledWith(999);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, expect.stringContaining('Business with ID 999 not found'));
        });

        it('should return 401 if user is not authenticated', async () => {
            req.params = { businessId: '1' };
            req.body = { name: 'Test Exam' };
            delete req.user; // Unauthenticated

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });

            // Note: Controller checks auth BEFORE calling service
            await ExamController.createExam(req as Request, res as Response);

            expect(ApiResponseHandler.unauthorized).toHaveBeenCalledWith(res, 'User not authenticated');
        });
    });

    describe('getExam', () => {
        it('should get an exam by ID', async () => {
            req.params = { id: '1', businessId: '1' };
            const mockExam = { id: 1, name: 'Test Exam', businessId: 1 };

            (examService.getExam as jest.Mock).mockResolvedValue(mockExam);

            await ExamController.getExam(req as Request, res as Response);

            expect(examService.getExam).toHaveBeenCalledWith(1, expect.any(Object));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExam, 'Exam fetched successfully');
        });

        it('should return 404 if exam belongs to another business', async () => {
            req.params = { id: '1', businessId: '1' };
            const mockExam = { id: 1, name: 'Test Exam', businessId: 2 }; // different business

            (examService.getExam as jest.Mock).mockResolvedValue(mockExam);

            await ExamController.getExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Exam not found in this business');
        });

        it('should return 404 if exam not found', async () => {
            req.params = { id: '999', businessId: '1' };
            (examService.getExam as jest.Mock).mockRejectedValue(new NotFoundError('Exam not found'));

            await ExamController.getExam(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalled();
        });
    });

    describe('getExamsByBusiness', () => {
        it('should get exams for a business', async () => {
            req.params = { businessId: '1' };
            const mockExams = [{ id: 1, name: 'Exam 1' }];

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (examService.getExamsByBusiness as jest.Mock).mockResolvedValue(mockExams);

            await ExamController.getExamsByBusiness(req as Request, res as Response);

            expect(examService.getExamsByBusiness).toHaveBeenCalledWith(1, expect.any(Object));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockExams, 'Exams fetched successfully');
        });
    });

    describe('updateExam', () => {
        it('should update an exam successfully', async () => {
            req.params = { id: '1', businessId: '1' };
            req.body = { name: 'Updated Exam' };
            const updatedExam = { id: 1, name: 'Updated Exam', businessId: 1 };

            // Mock check existence
            (examService.getExam as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (examService.updateExam as jest.Mock).mockResolvedValue(updatedExam);

            await ExamController.updateExam(req as Request, res as Response);

            expect(examService.updateExam).toHaveBeenCalledWith(1, req.body, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedExam, 'Exam updated successfully');
        });
    });

    describe('deleteExam', () => {
        it('should delete an exam successfully', async () => {
            req.params = { id: '1', businessId: '1' };

            // Mock check existence
            (examService.getExam as jest.Mock).mockResolvedValue({ id: 1, businessId: 1 });
            (examService.deleteExam as jest.Mock).mockResolvedValue({ id: 1 });

            await ExamController.deleteExam(req as Request, res as Response);

            expect(examService.deleteExam).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Exam deleted successfully');
        });
    });
});
