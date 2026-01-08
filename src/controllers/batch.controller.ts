import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateBatchDto, UpdateBatchDto, AddUserToBatchDto, RemoveUserFromBatchDto, UpdateBatchUserDto } from '../dtos/batch.dto';
import { BatchService } from '../services/batch.service';
import { QueryBuilder } from '../utils/queryBuilder';

const batchService = new BatchService();

export const createBatch = async (req: Request, res: Response) => {
  try {
    const batchData = plainToInstance(CreateBatchDto, req.body);

    const batch = await batchService.createBatch(batchData);

    ApiResponseHandler.success(res, batch, 'Batch created successfully', 201);
  } catch (error: any) {
    if (error instanceof BadRequestError || error instanceof AlreadyExistsError || error instanceof NotFoundError) {
      return ApiResponseHandler.error(res, error.message, (error instanceof NotFoundError || error.name === 'NotFoundError') ? 404 : ((error instanceof AlreadyExistsError || error.name === 'AlreadyExistsError') ? 409 : 400));
    }
    logger.error(`Error creating batch: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to create batch');
  }
};

export const getBatch = async (req: Request, res: Response) => {
  try {
    const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
    const batch = await batchService.getBatch(id);
    ApiResponseHandler.success(res, batch, 'Batch fetched successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError || error.name === 'NotFoundError') {
      return ApiResponseHandler.notFound(res, error.message);
    }
    ApiResponseHandler.error(res, 'Failed to fetch batch');
  }
};

export const getBatchesByCourse = async (req: Request, res: Response) => {
  try {
    const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');
    const options = QueryBuilder.parse(req.query);

    if (req.query.active === 'true') {
      options.where = { ...options.where, isActive: true };
    }

    const batches = await batchService.getBatchesByCourse(courseId, options);
    ApiResponseHandler.success(res, batches, 'Batches fetched successfully');
  } catch (error: any) {
    logger.error(`Error fetching batches for course: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to fetch batches');
  }
};

export const updateBatch = async (req: Request, res: Response) => {
  try {
    const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
    const batchData = plainToInstance(UpdateBatchDto, req.body);

    const batch = await batchService.updateBatch(id, batchData);
    ApiResponseHandler.success(res, batch, 'Batch updated successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError) return ApiResponseHandler.notFound(res, error.message);
    if (error instanceof AlreadyExistsError) return ApiResponseHandler.error(res, error.message, 409);
    logger.error(`Error updating batch: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to update batch');
  }
};

export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
    await batchService.deleteBatch(id);
    ApiResponseHandler.success(res, null, 'Batch deleted successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError) return ApiResponseHandler.notFound(res, error.message);
    logger.error(`Error deleting batch: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to delete batch');
  }
};

// Batch User Operations

// Batch User Operations

export const addUserToBatch = async (req: Request, res: Response) => {
  try {
    const { userId, batchId } = plainToInstance(AddUserToBatchDto, req.body);
    ValidationUtils.validateId(userId, 'User ID');
    ValidationUtils.validateId(batchId, 'Batch ID');

    const result = await batchService.addUserToBatch(userId, batchId);
    ApiResponseHandler.success(res, result, 'User added to batch successfully', 201);
  } catch (error: any) {
    if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
    if (error instanceof AlreadyExistsError || error.name === 'AlreadyExistsError') return ApiResponseHandler.error(res, error.message, 409);
    logger.error(`Error adding user to batch: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to add user to batch');
  }
};

export const removeUserFromBatch = async (req: Request, res: Response) => {
  try {
    const { userId, batchId } = plainToInstance(RemoveUserFromBatchDto, req.body);
    ValidationUtils.validateId(userId, 'User ID');
    ValidationUtils.validateId(batchId, 'Batch ID');

    await batchService.removeUserFromBatch(userId, batchId);
    ApiResponseHandler.success(res, null, 'User removed from batch successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
    logger.error(`Error removing user from batch: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to remove user from batch');
  }
};

export const getBatchWithUsers = async (req: Request, res: Response) => {
  try {
    const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
    const batch = await batchService.getBatchWithUsers(id);
    ApiResponseHandler.success(res, batch, 'Batch with users fetched successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
    logger.error(`Error fetching batch with users: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to fetch batch with users');
  }
};

export const getBatchesByUser = async (req: Request, res: Response) => {
  try {
    const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
    const batches = await batchService.getBatchesByUser(userId);
    ApiResponseHandler.success(res, batches, 'User batches fetched successfully');
  } catch (error: any) {
    logger.error(`Error fetching user batches: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to fetch user batches');
  }
};

export const getUsersByBatch = async (req: Request, res: Response) => {
  try {
    const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
    const users = await batchService.getUsersByBatch(batchId);
    ApiResponseHandler.success(res, users, 'Batch users fetched successfully');
  } catch (error: any) {
    logger.error(`Error fetching batch users: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to fetch batch users');
  }
};

export const updateBatchUser = async (req: Request, res: Response) => {
  try {
    const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
    const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
    const { isActive } = plainToInstance(UpdateBatchUserDto, req.body);

    const updated = await batchService.updateBatchUser(batchId, userId, { isActive });
    ApiResponseHandler.success(res, updated, 'Batch user updated successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
    logger.error(`Error updating batch user: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to update batch user');
  }
};
