import { Request, Response } from 'express';
import * as BatchController from '../../../src/controllers/batch.controller';
import * as BatchRepo from '../../../src/repositories/batch.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as UserRepo from '../../../src/repositories/user.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Batch Controller', () => {
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

    // ==================== BATCH CRUD TESTS ====================

    describe('createBatch', () => {
        const validBatchData = {
            codeName: 'BATCH001',
            displayName: 'Test Batch',
            startDate: '2024-01-01',
            endDate: '2024-06-30',
            courseId: 1
        };

        it('should create a batch successfully', async () => {
            req.body = validBatchData;

            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Course' });
            (BatchRepo.findBatchByCodeName as jest.Mock).mockResolvedValue(null);
            (BatchRepo.createBatch as jest.Mock).mockResolvedValue({ id: 1, ...validBatchData });

            await BatchController.createBatch(req as Request, res as Response);

            expect(CourseRepo.findCourseById).toHaveBeenCalledWith(1);
            expect(BatchRepo.createBatch).toHaveBeenCalled();
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.objectContaining({ id: 1 }), 'Batch created successfully', 201);
        });

        it('should throw error if codeName is missing', async () => {
            req.body = { ...validBatchData, codeName: '' };

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Batch code name is required and cannot be empty');
        });

        it('should throw error if displayName is missing', async () => {
            req.body = { ...validBatchData, displayName: '' };

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Batch display name is required and cannot be empty');
        });

        it('should throw error if dates are missing', async () => {
            req.body = { ...validBatchData, startDate: undefined, endDate: undefined };

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Start date and end date are required');
        });

        it('should throw error if courseId is missing', async () => {
            req.body = { ...validBatchData, courseId: undefined };

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Course ID is required');
        });

        it('should throw error if end date is before start date', async () => {
            req.body = { ...validBatchData, startDate: '2024-06-30', endDate: '2024-01-01' };

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('End date must be after Start date');
        });

        it('should throw error if course not found', async () => {
            req.body = validBatchData;
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Course not found');
        });

        it('should throw error if codeName already exists', async () => {
            req.body = validBatchData;
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchByCodeName as jest.Mock).mockResolvedValue({ id: 2, codeName: 'BATCH001' });

            await expect(BatchController.createBatch(req as Request, res as Response)).rejects.toThrow('Batch with this code name already exists');
        });
    });

    describe('getBatch', () => {
        it('should get a batch by ID', async () => {
            req.params = { id: '1' };
            const mockBatch = { id: 1, codeName: 'BATCH001', displayName: 'Test Batch' };

            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(mockBatch);

            await BatchController.getBatch(req as Request, res as Response);

            expect(BatchRepo.findBatchById).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatch, 'Batch fetched successfully');
        });

        it('should throw error if batch not found', async () => {
            req.params = { id: '999' };
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.getBatch(req as Request, res as Response)).rejects.toThrow('Batch not found');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { id: 'invalid' };

            await expect(BatchController.getBatch(req as Request, res as Response)).rejects.toThrow('Batch ID is required and must be a valid positive integer');
        });
    });

    describe('getBatchWithUsers', () => {
        it('should get a batch with its users', async () => {
            req.params = { id: '1' };
            const mockBatch = {
                id: 1,
                codeName: 'BATCH001',
                batchUsers: [{ id: 1, user: { id: 1, name: 'User 1' } }]
            };

            (BatchRepo.findBatchWithUsers as jest.Mock).mockResolvedValue(mockBatch);

            await BatchController.getBatchWithUsers(req as Request, res as Response);

            expect(BatchRepo.findBatchWithUsers).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatch, 'Batch with users fetched successfully');
        });

        it('should throw error if batch not found', async () => {
            req.params = { id: '999' };
            (BatchRepo.findBatchWithUsers as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.getBatchWithUsers(req as Request, res as Response)).rejects.toThrow('Batch not found');
        });
    });

    describe('getBatchesByCourse', () => {
        it('should get batches for a course', async () => {
            req.params = { courseId: '1' };
            req.query = {};
            const mockBatches = [{ id: 1, codeName: 'BATCH001' }, { id: 2, codeName: 'BATCH002' }];

            (BatchRepo.findBatchesByCourseId as jest.Mock).mockResolvedValue(mockBatches);

            await BatchController.getBatchesByCourse(req as Request, res as Response);

            expect(BatchRepo.findBatchesByCourseId).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatches, 'Batches fetched successfully');
        });

        it('should throw error if courseId is invalid', async () => {
            req.params = { courseId: 'invalid' };
            req.query = {};

            await expect(BatchController.getBatchesByCourse(req as Request, res as Response)).rejects.toThrow('Course ID is required and must be a valid positive integer');
        });
    });

    describe('updateBatch', () => {
        it('should update a batch successfully', async () => {
            req.params = { id: '1' };
            req.body = { displayName: 'Updated Batch' };
            const updatedBatch = { id: 1, codeName: 'BATCH001', displayName: 'Updated Batch' };

            (BatchRepo.updateBatch as jest.Mock).mockResolvedValue(updatedBatch);

            await BatchController.updateBatch(req as Request, res as Response);

            expect(BatchRepo.updateBatch).toHaveBeenCalledWith(1, req.body);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedBatch, 'Batch updated successfully');
        });

        it('should throw error if codeName is empty', async () => {
            req.params = { id: '1' };
            req.body = { codeName: '   ' };

            await expect(BatchController.updateBatch(req as Request, res as Response)).rejects.toThrow('Batch code name is required and cannot be empty');
        });

        it('should throw error if displayName is empty', async () => {
            req.params = { id: '1' };
            req.body = { displayName: '   ' };

            await expect(BatchController.updateBatch(req as Request, res as Response)).rejects.toThrow('Batch display name is required and cannot be empty');
        });
    });

    describe('deleteBatch', () => {
        it('should delete a batch successfully', async () => {
            req.params = { id: '1' };

            (BatchRepo.deleteBatch as jest.Mock).mockResolvedValue({ id: 1 });

            await BatchController.deleteBatch(req as Request, res as Response);

            expect(BatchRepo.deleteBatch).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Batch deleted successfully');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { id: 'invalid' };

            await expect(BatchController.deleteBatch(req as Request, res as Response)).rejects.toThrow('Batch ID is required and must be a valid positive integer');
        });
    });

    // ==================== BATCH USER TESTS ====================

    describe('addUserToBatch', () => {
        it('should add user to batch successfully', async () => {
            req.body = { userId: 1, batchId: 1 };

            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test User' });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 1, codeName: 'BATCH001' });
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);
            (BatchRepo.addUserToBatch as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });

            await BatchController.addUserToBatch(req as Request, res as Response);

            expect(BatchRepo.addUserToBatch).toHaveBeenCalledWith(1, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.any(Object), 'User added to batch successfully', 201);
        });

        it('should throw error if userId or batchId is missing', async () => {
            req.body = { batchId: 1 };

            await expect(BatchController.addUserToBatch(req as Request, res as Response)).rejects.toThrow('User ID is required and must be a valid positive integer');
        });

        it('should throw error if user not found', async () => {
            req.body = { userId: 999, batchId: 1 };
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.addUserToBatch(req as Request, res as Response)).rejects.toThrow('User not found');
        });

        it('should throw error if batch not found', async () => {
            req.body = { userId: 1, batchId: 999 };
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.addUserToBatch(req as Request, res as Response)).rejects.toThrow('Batch not found');
        });

        it('should throw error if user is already in batch', async () => {
            req.body = { userId: 1, batchId: 1 };
            (UserRepo.findPublicById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchById as jest.Mock).mockResolvedValue({ id: 1 });
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });

            await expect(BatchController.addUserToBatch(req as Request, res as Response)).rejects.toThrow('User is already in this batch');
        });
    });

    describe('removeUserFromBatch', () => {
        it('should remove user from batch successfully', async () => {
            req.body = { userId: 1, batchId: 1 };

            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });
            (BatchRepo.removeUserFromBatch as jest.Mock).mockResolvedValue({ id: 1 });

            await BatchController.removeUserFromBatch(req as Request, res as Response);

            expect(BatchRepo.removeUserFromBatch).toHaveBeenCalledWith(1, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'User removed from batch successfully');
        });

        it('should throw error if userId or batchId is missing', async () => {
            req.body = { batchId: 1 };

            await expect(BatchController.removeUserFromBatch(req as Request, res as Response)).rejects.toThrow('User ID is required and must be a valid positive integer');
        });

        it('should throw error if user is not in batch', async () => {
            req.body = { userId: 1, batchId: 1 };
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.removeUserFromBatch(req as Request, res as Response)).rejects.toThrow('User is not in this batch');
        });
    });

    describe('getBatchesByUser', () => {
        it('should get batches for a user', async () => {
            req.params = { userId: '1' };
            const mockBatchUsers = [{ id: 1, batch: { id: 1, codeName: 'BATCH001' } }];

            (BatchRepo.findBatchesByUserId as jest.Mock).mockResolvedValue(mockBatchUsers);

            await BatchController.getBatchesByUser(req as Request, res as Response);

            expect(BatchRepo.findBatchesByUserId).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatchUsers, 'User batches fetched successfully');
        });

        it('should throw error if userId is invalid', async () => {
            req.params = { userId: 'invalid' };

            await expect(BatchController.getBatchesByUser(req as Request, res as Response)).rejects.toThrow('User ID is required and must be a valid positive integer');
        });
    });

    describe('getUsersByBatch', () => {
        it('should get users for a batch', async () => {
            req.params = { batchId: '1' };
            const mockBatchUsers = [{ id: 1, user: { id: 1, name: 'User 1' } }];

            (BatchRepo.findUsersByBatchId as jest.Mock).mockResolvedValue(mockBatchUsers);

            await BatchController.getUsersByBatch(req as Request, res as Response);

            expect(BatchRepo.findUsersByBatchId).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatchUsers, 'Batch users fetched successfully');
        });

        it('should throw error if batchId is invalid', async () => {
            req.params = { batchId: 'invalid' };

            await expect(BatchController.getUsersByBatch(req as Request, res as Response)).rejects.toThrow('Batch ID is required and must be a valid positive integer');
        });
    });

    describe('updateBatchUser', () => {
        it('should update batch user successfully', async () => {
            req.params = { userId: '1', batchId: '1' };
            req.body = { isActive: false };

            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1 });
            (BatchRepo.updateBatchUser as jest.Mock).mockResolvedValue({ id: 1, userId: 1, batchId: 1, isActive: false });

            await BatchController.updateBatchUser(req as unknown as Request<{ userId: number; batchId: number }>, res as Response);

            expect(BatchRepo.updateBatchUser).toHaveBeenCalledWith(1, 1, { isActive: false });
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.any(Object), 'Batch user updated successfully');
        });

        it('should throw error if userId is invalid', async () => {
            req.params = { userId: 'invalid', batchId: '1' };
            req.body = { isActive: false };

            await expect(BatchController.updateBatchUser(req as unknown as Request<{ userId: number; batchId: number }>, res as Response)).rejects.toThrow('User ID is required and must be a valid positive integer');
        });

        it('should throw error if user is not in batch', async () => {
            req.params = { userId: '1', batchId: '1' };
            req.body = { isActive: false };
            (BatchRepo.findBatchUser as jest.Mock).mockResolvedValue(null);

            await expect(BatchController.updateBatchUser(req as unknown as Request<{ userId: number; batchId: number }>, res as Response)).rejects.toThrow('User is not in this batch');
        });
    });
});
