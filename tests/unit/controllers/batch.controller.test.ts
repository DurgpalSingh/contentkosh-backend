import { Request, Response } from 'express';
import { batchController } from '../../../src/controllers/batch.controller';
import { BatchService } from '../../../src/services/batch.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../../../src/errors/api.errors';

// Do NOT mock BatchService module. Use spyOn.
// Do NOT mock ValidationUtils. Use real implementation.
// Do NOT mock api.errors. Use real implementation.

// Mock dependencies of ApiResponseHandler and Logger only to avoid noise
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Batch Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    // Spies
    let createBatchSpy: jest.SpyInstance;
    let getBatchSpy: jest.SpyInstance;
    let getBatchesByCourseSpy: jest.SpyInstance;
    let updateBatchSpy: jest.SpyInstance;
    let deleteBatchSpy: jest.SpyInstance;
    let addUserToBatchSpy: jest.SpyInstance;
    let removeUserFromBatchSpy: jest.SpyInstance;
    let getBatchesByUserSpy: jest.SpyInstance;
    let getUsersByBatchSpy: jest.SpyInstance;
    let updateBatchUserSpy: jest.SpyInstance;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();

        // Spy on BatchService prototype methods
        createBatchSpy = jest.spyOn(BatchService.prototype, 'createBatch');
        getBatchSpy = jest.spyOn(BatchService.prototype, 'getBatch');
        getBatchesByCourseSpy = jest.spyOn(BatchService.prototype, 'getBatchesByCourse');
        updateBatchSpy = jest.spyOn(BatchService.prototype, 'updateBatch');
        deleteBatchSpy = jest.spyOn(BatchService.prototype, 'deleteBatch');
        addUserToBatchSpy = jest.spyOn(BatchService.prototype, 'addUserToBatch');
        removeUserFromBatchSpy = jest.spyOn(BatchService.prototype, 'removeUserFromBatch');
        getBatchesByUserSpy = jest.spyOn(BatchService.prototype, 'getBatchesByUser');
        getUsersByBatchSpy = jest.spyOn(BatchService.prototype, 'getUsersByBatch');
        updateBatchUserSpy = jest.spyOn(BatchService.prototype, 'updateBatchUser');
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
            const createdBatch = { id: 1, ...validBatchData };

            createBatchSpy.mockResolvedValue(createdBatch as any);

            await batchController.createBatch(req as Request, res as Response);

            expect(createBatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                codeName: 'BATCH001',
                courseId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, createdBatch, 'Batch created successfully', 201);
        });

        it('should handle errors thrown by service', async () => {
            req.body = validBatchData;
            const error = new BadRequestError('Invalid batch data');
            createBatchSpy.mockRejectedValue(error);

            await batchController.createBatch(req as Request, res as Response);

            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Invalid batch data', 400);
        });

        it('should handle AlreadyExistsError', async () => {
            req.body = validBatchData;
            createBatchSpy.mockRejectedValue(new AlreadyExistsError('Batch'));
            await batchController.createBatch(req as Request, res as Response);
            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Batch already exists', 409);
        });


    });

    describe('getBatch', () => {
        it('should get a batch by ID', async () => {
            req.params = { id: '1' };
            const mockBatch = { id: 1, codeName: 'BATCH001' };

            getBatchSpy.mockResolvedValue(mockBatch as any);

            await batchController.getBatch(req as Request, res as Response);

            expect(getBatchSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatch, 'Batch fetched successfully');
        });

        it('should handle NotFoundError', async () => {
            req.params = { id: '999' };
            getBatchSpy.mockRejectedValue(new NotFoundError('Batch'));

            await batchController.getBatch(req as Request, res as Response);

            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Batch not found');
        });

        it('should throw error if ID is invalid', async () => {
            req.params = { id: 'invalid' };

            await batchController.getBatch(req as Request, res as Response);

            expect(getBatchSpy).not.toHaveBeenCalled();
            // Validation error is generic BadRequest, controller catches generic
            expect(ApiResponseHandler.error).toHaveBeenCalled();
        });
    });

    describe('getBatchesByCourse', () => {
        it('should get batches for a course', async () => {
            req.params = { courseId: '1' };
            req.query = {};
            const mockBatches = [{ id: 1 }];

            getBatchesByCourseSpy.mockResolvedValue(mockBatches as any);

            await batchController.getBatchesByCourse(req as Request, res as Response);

            expect(getBatchesByCourseSpy).toHaveBeenCalledWith(1, expect.any(Object));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockBatches, 'Batches fetched successfully');
        });

        it('should handle active filter', async () => {
            req.params = { courseId: '1' };
            req.query = { active: 'true' };
            getBatchesByCourseSpy.mockResolvedValue([]);
            await batchController.getBatchesByCourse(req as Request, res as Response);
            expect(getBatchesByCourseSpy).toHaveBeenCalledWith(1, expect.any(Object));
        });
    });

    describe('updateBatch', () => {
        it('should update a batch successfully', async () => {
            req.params = { id: '1' };
            req.body = { displayName: 'Updated' };
            const updatedBatch = { id: 1, displayName: 'Updated' };

            updateBatchSpy.mockResolvedValue(updatedBatch as any);

            await batchController.updateBatch(req as Request, res as Response);

            expect(updateBatchSpy).toHaveBeenCalledWith(1, expect.objectContaining({ displayName: 'Updated' }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, updatedBatch, 'Batch updated successfully');
        });

        it('should handle NotFoundError', async () => {
            req.params = { id: '1' };
            req.body = { displayName: 'Updated' };
            updateBatchSpy.mockRejectedValue(new NotFoundError('Batch'));
            await batchController.updateBatch(req as Request, res as Response);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Batch not found');
        });

        it('should handle AlreadyExistsError', async () => {
            req.params = { id: '1' };
            req.body = { codeName: 'Existing' };
            updateBatchSpy.mockRejectedValue(new AlreadyExistsError('Batch'));
            await batchController.updateBatch(req as Request, res as Response);
            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Batch already exists', 409);
        });
    });

    describe('deleteBatch', () => {
        it('should delete a batch successfully', async () => {
            req.params = { id: '1' };
            deleteBatchSpy.mockResolvedValue({ id: 1 } as any);

            await batchController.deleteBatch(req as Request, res as Response);

            expect(deleteBatchSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'Batch deleted successfully');
        });

        it('should handle NotFoundError', async () => {
            req.params = { id: '1' };
            deleteBatchSpy.mockRejectedValue(new NotFoundError('Batch'));
            await batchController.deleteBatch(req as Request, res as Response);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'Batch not found');
        });
    });

    describe('addUserToBatch', () => {
        it('should add user to batch', async () => {
            req.body = { userId: 1, batchId: 1 };
            addUserToBatchSpy.mockResolvedValue({ userId: 1, batchId: 1 } as any);

            await batchController.addUserToBatch(req as Request, res as Response);

            expect(addUserToBatchSpy).toHaveBeenCalledWith(1, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, expect.anything(), 'User added to batch successfully', 201);
        });

        it('should handle NotFoundError', async () => {
            req.body = { userId: 1, batchId: 1 };
            addUserToBatchSpy.mockRejectedValue(new NotFoundError('User'));
            await batchController.addUserToBatch(req as Request, res as Response);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'User not found');
        });

        it('should handle AlreadyExistsError', async () => {
            req.body = { userId: 1, batchId: 1 };
            addUserToBatchSpy.mockRejectedValue(new AlreadyExistsError('User'));
            await batchController.addUserToBatch(req as Request, res as Response);
            expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'User already exists', 409);
        });
    });

    describe('removeUserFromBatch', () => {
        it('should remove user from batch', async () => {
            req.body = { userId: 1, batchId: 1 };
            removeUserFromBatchSpy.mockResolvedValue({ id: 1 } as any);

            await batchController.removeUserFromBatch(req as Request, res as Response);

            expect(removeUserFromBatchSpy).toHaveBeenCalledWith(1, 1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, null, 'User removed from batch successfully');
        });

        it('should handle NotFoundError', async () => {
            req.body = { userId: 1, batchId: 1 };
            removeUserFromBatchSpy.mockRejectedValue(new NotFoundError('User'));
            await batchController.removeUserFromBatch(req as Request, res as Response);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'User not found');
        });
    });

    describe('getBatchesByUser', () => {
        it('should get batches by user', async () => {
            req.params = { userId: '1' };
            const mockData = [{ id: 1 }];
            getBatchesByUserSpy.mockResolvedValue(mockData as any);

            await batchController.getBatchesByUser(req as Request, res as Response);

            expect(getBatchesByUserSpy).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockData, 'User batches fetched successfully');
        });
    });

    describe('getUsersByBatch', () => {
        it('should get users for a batch', async () => {
            req.params = { batchId: '1' };
            req.query = {};
            const mockData = [{ id: 1 }];
            getUsersByBatchSpy.mockResolvedValue(mockData as any);

            await batchController.getUsersByBatch(req as Request, res as Response);

            expect(getUsersByBatchSpy).toHaveBeenCalledWith(1, undefined);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockData, 'Batch users fetched successfully');
        });
    });

    describe('updateBatchUser', () => {
        it('should update batch user', async () => {
            req.params = { batchId: '1', userId: '1' };
            req.body = { isActive: false };
            const mockData = { id: 1, isActive: false };
            updateBatchUserSpy.mockResolvedValue(mockData as any);

            await batchController.updateBatchUser(req as any, res as Response);

            expect(updateBatchUserSpy).toHaveBeenCalledWith(1, 1, expect.objectContaining({ isActive: false }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, mockData, 'Batch user updated successfully');
        });

        it('should handle NotFoundError', async () => {
            req.params = { batchId: '1', userId: '1' };
            req.body = { isActive: false };
            updateBatchUserSpy.mockRejectedValue(new NotFoundError('User'));
            await batchController.updateBatchUser(req as any, res as Response);
            expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(res, 'User not found');
        });
    });

});
