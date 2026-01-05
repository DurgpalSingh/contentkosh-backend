import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as batchRepo from '../repositories/batch.repo';
import * as courseRepo from '../repositories/course.repo';
import * as userRepo from '../repositories/user.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';
import { ValidationUtils } from '../utils/validation';

export const createBatch = async (req: Request, res: Response) => {
    const batchData: Prisma.BatchUncheckedCreateInput = req.body;

    // Validate input
    ValidationUtils.validateNonEmptyString(batchData.codeName, 'Batch code name');
    ValidationUtils.validateNonEmptyString(batchData.displayName, 'Batch display name');
    ValidationUtils.validateRequired(batchData.courseId, 'Course ID');

    if (!batchData.startDate || !batchData.endDate) {
      throw new BadRequestError('Start date and end date are required');
    }

    // Validate date range
    const { start: startDate, end: endDate } = ValidationUtils.validateDateRange(batchData.startDate, batchData.endDate);

    // Check if course exists
    const course = await courseRepo.findCourseById(batchData.courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    // Check if code name already exists
    const existingBatch = await batchRepo.findBatchByCodeName(batchData.codeName);
    if (existingBatch) {
      throw new AlreadyExistsError('Batch with this code name already exists');
    }

    const createInput: Prisma.BatchCreateInput = {
        codeName: batchData.codeName,
        displayName: batchData.displayName,
        startDate: batchData.startDate,
        endDate: batchData.endDate,
        course: {
            connect: {
                id: batchData.courseId
              }
        }
    };

    if (batchData.isActive !== undefined) {
      createInput.isActive = batchData.isActive;
    }

    const batch = await batchRepo.createBatch(createInput);
    
    logger.info(`Batch created successfully: ${batchData.codeName}`);

    ApiResponseHandler.success(res, batch, 'Batch created successfully', 201);
};

function getBatchIdFromRequest(req: Request): number {
    return ValidationUtils.validateId(req.params.id, 'Batch ID');
}

export const getBatch = async (req: Request, res: Response) => {
    const id = getBatchIdFromRequest(req);

    const batch = await batchRepo.findBatchById(id);
    if (!batch) {
        throw new NotFoundError('Batch not found');
    }

    logger.info(`Batch fetched successfully: ${batch.codeName}`);

    ApiResponseHandler.success(res, batch, 'Batch fetched successfully');
};

export const getBatchWithUsers = async (req: Request, res: Response) => {
    const id = getBatchIdFromRequest(req);

    const batch = await batchRepo.findBatchWithUsers(id);
    if (!batch) {
        throw new NotFoundError('Batch not found');
    }

    logger.info(`Batch with users fetched successfully: ${batch.codeName}`);

    ApiResponseHandler.success(res, batch, 'Batch with users fetched successfully');
};

export const getBatchesByCourse = async (req: Request, res: Response) => {
    const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');

    const activeOnly = req.query.active === 'true';
    
    let batches;
    if (activeOnly) {
      batches = await batchRepo.findActiveBatchesByCourseId(courseId);
    } else {
      batches = await batchRepo.findBatchesByCourseId(courseId);
    }

      logger.info(`Batches fetched for course ${courseId}`);

    ApiResponseHandler.success(res, batches, 'Batches fetched successfully');
};

export const updateBatch = async (req: Request, res: Response) => {
    const id = getBatchIdFromRequest(req);
    const batchData: Prisma.BatchUncheckedUpdateInput = req.body;

    // Validate input
    if (batchData.codeName !== undefined) {
        ValidationUtils.validateNonEmptyString(batchData.codeName.toString(), 'Batch code name');
    }

    if (batchData.displayName !== undefined) {
        ValidationUtils.validateNonEmptyString(batchData.displayName.toString(), 'Batch display name');
    }

    // Validate date range if both dates are provided
    if (batchData.startDate && batchData.endDate) {
        ValidationUtils.validateDateRange(batchData.startDate.toString(), batchData.endDate.toString());
    }

    // Check if code name already exists (if being updated)
    if (batchData.codeName) {
      const existingBatch = await batchRepo.findBatchByCodeName(batchData.codeName.toString());
      if (existingBatch && existingBatch.id !== id) {
        throw new AlreadyExistsError('Batch with this code name already exists');
      }
    }

    const batch = await batchRepo.updateBatch(id, batchData);

    logger.info(`Batch updated successfully: ${batch.codeName}`);

    ApiResponseHandler.success(res, batch, 'Batch updated successfully');
};

export const deleteBatch = async (req: Request, res: Response) => {
    const id = getBatchIdFromRequest(req);

    await batchRepo.deleteBatch(id);

    logger.info(`Batch deleted successfully: ID ${id}`);

    ApiResponseHandler.success(res, null, 'Batch deleted successfully');
};

// ==================== BATCH USER FUNCTIONS ====================

export const addUserToBatch = async (req: Request, res: Response) => {
    const { userId, batchId }: { userId: number; batchId: number } = req.body;

    // Validate input
    ValidationUtils.validateId(userId, 'User ID');
    ValidationUtils.validateId(batchId, 'Batch ID');

    // Check if user exists
    const user = await userRepo.findPublicById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if batch exists
    const batch = await batchRepo.findBatchById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    // Check if user is already in this batch
    const existingBatchUser = await batchRepo.findBatchUser(userId, batchId);
    if (existingBatchUser) {
      throw new AlreadyExistsError('User is already in this batch');
    }

    const batchUser = await batchRepo.addUserToBatch(userId, batchId);

    logger.info(`User ${userId} added to batch ${batchId}`);

    ApiResponseHandler.success(res, batchUser, 'User added to batch successfully', 201);
};

export const removeUserFromBatch = async (req: Request, res: Response) => {
    const { userId, batchId }: { userId: number; batchId: number } = req.body;

    // Validate input
    ValidationUtils.validateId(userId, 'User ID');
    ValidationUtils.validateId(batchId, 'Batch ID');

    // Check if user is in this batch
    const existingBatchUser = await batchRepo.findBatchUser(userId, batchId);
    if (!existingBatchUser) {
      throw new NotFoundError('User is not in this batch');
    }

    await batchRepo.removeUserFromBatch(userId, batchId);

    logger.info(`User ${userId} removed from batch ${batchId}`);

    ApiResponseHandler.success(res, null, 'User removed from batch successfully');
};

export const getBatchesByUser = async (req: Request, res: Response) => {
    const userId = ValidationUtils.validateId(req.params.userId, 'User ID');

    const batchUsers = await batchRepo.findBatchesByUserId(userId);

    logger.info(`Batches fetched for user ${userId}`);

    ApiResponseHandler.success(res, batchUsers, 'User batches fetched successfully');
};

export const getUsersByBatch = async (req: Request, res: Response) => {
    const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');

    const batchUsers = await batchRepo.findUsersByBatchId(batchId);

    logger.info(`Users fetched for batch ${batchId}`);

    ApiResponseHandler.success(res, batchUsers, 'Batch users fetched successfully');
};

export const updateBatchUser = async (req: Request<{ userId: number; batchId: number }>, res: Response) => {
    const { userId, batchId } = req.params;
    const { isActive } = req.body;

    // Validate input
    ValidationUtils.validateId(userId, 'User ID');
    ValidationUtils.validateId(batchId, 'Batch ID');

    // Check if user is in this batch
    const existingBatchUser = await batchRepo.findBatchUser(Number(userId), Number(batchId));
    if (!existingBatchUser) {
      throw new NotFoundError('User is not in this batch');
    }

    const batchUser = await batchRepo.updateBatchUser(Number(userId), Number(batchId), { isActive });

    logger.info(`Batch user updated: User ${userId} in batch ${batchId}`);

    ApiResponseHandler.success(res, batchUser, 'Batch user updated successfully');
};
