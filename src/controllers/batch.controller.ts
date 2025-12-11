import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import * as batchRepo from '../repositories/batch.repo';
import * as courseRepo from '../repositories/course.repo';
import * as userRepo from '../repositories/user.repo';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';
import { Prisma } from '@prisma/client';

export const createBatch = async (req: Request, res: Response) => {
    const batchData: Prisma.BatchUncheckedCreateInput = req.body;

    // Validate input
    if (!batchData.codeName || !batchData.codeName.trim()) {
      throw new BadRequestError('Batch code name is required');
    }

    if (!batchData.displayName || !batchData.displayName.trim()) {
      throw new BadRequestError('Batch display name is required');
    }

    if (!batchData.startDate || !batchData.endDate) {
      throw new BadRequestError('Start date and end date are required');
    }

    if (!batchData.courseId) {
      throw new BadRequestError('Course ID is required');
    }

    // Validate date range
    const startDate = new Date(batchData.startDate);
    const endDate = new Date(batchData.endDate);
    
    if (startDate >= endDate) {
      throw new BadRequestError('End date must be after start date');
    }

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

    const batch = await batchRepo.createBatch({
      ...batchData,
      course: {
        connect: {
          id: batchData.courseId
        }
      }
    });

    logger.info(`Batch created successfully: ${batchData.codeName}`);

    ApiResponseHandler.success(res, batch, 'Batch created successfully', 201);
};

function getBatchIdFromRequest(req: Request): number {
    const id = Number(req.params.id);
    if (Number.isInteger(id) && id > 0) {
        return id;
    }
    throw new BadRequestError('Batch ID is required');
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
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new BadRequestError('Valid Course ID is required');
    }

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
    if (batchData.codeName !== undefined && !batchData.codeName.toString().trim()) {
      throw new BadRequestError('Batch code name cannot be empty');
    }

    if (batchData.displayName !== undefined && !batchData.displayName.toString().trim()) {
      throw new BadRequestError('Batch display name cannot be empty');
    }

    // Validate date range if both dates are provided
    if (batchData.startDate && batchData.endDate) {
      const startDate = new Date(batchData.startDate.toString());
      const endDate = new Date(batchData.endDate.toString());
      
      if (startDate >= endDate) {
        throw new BadRequestError('End date must be after start date');
      }
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
    if (!userId || !batchId) {
      throw new BadRequestError('User ID and Batch ID are required');
    }

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
    if (!userId || !batchId) {
      throw new BadRequestError('User ID and Batch ID are required');
    }

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
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new BadRequestError('Valid User ID is required');
    }

    const batchUsers = await batchRepo.findBatchesByUserId(userId);

    logger.info(`Batches fetched for user ${userId}`);

    ApiResponseHandler.success(res, batchUsers, 'User batches fetched successfully');
};

export const getUsersByBatch = async (req: Request, res: Response) => {
    const batchId = Number(req.params.batchId);
    if (!Number.isInteger(batchId) || batchId <= 0) {
        throw new BadRequestError('Valid Batch ID is required');
    }

    const batchUsers = await batchRepo.findUsersByBatchId(batchId);

    logger.info(`Users fetched for batch ${batchId}`);

    ApiResponseHandler.success(res, batchUsers, 'Batch users fetched successfully');
};

export const updateBatchUser = async (req: Request<{ userId: number; batchId: number }>, res: Response) => {
    const { userId, batchId } = req.params;
    const { isActive } = req.body;

    // Validate input
    if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
        throw new BadRequestError('Valid User ID is required');
    }

    if (!Number.isInteger(Number(batchId)) || Number(batchId) <= 0) {
        throw new BadRequestError('Valid Batch ID is required');
    }

    // Check if user is in this batch
    const existingBatchUser = await batchRepo.findBatchUser(Number(userId), Number(batchId));
    if (!existingBatchUser) {
      throw new NotFoundError('User is not in this batch');
    }

    const batchUser = await batchRepo.updateBatchUser(Number(userId), Number(batchId), { isActive });

    logger.info(`Batch user updated: User ${userId} in batch ${batchId}`);

    ApiResponseHandler.success(res, batchUser, 'Batch user updated successfully');
};
