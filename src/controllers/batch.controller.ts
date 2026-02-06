import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, AlreadyExistsError, ForbiddenError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateBatchDto, UpdateBatchDto, AddUserToBatchDto, RemoveUserFromBatchDto, UpdateBatchUserDto } from '../dtos/batch.dto';
import { BatchService } from '../services/batch.service';
import { QueryBuilder } from '../utils/queryBuilder';

export class BatchController {
  private batchService: BatchService;

  constructor(batchService: BatchService) {
    this.batchService = batchService;
  }

  public createBatch = async (req: Request, res: Response) => {
    try {
      const batchData = plainToInstance(CreateBatchDto, req.body);

      const batch = await this.batchService.createBatch(batchData);

      ApiResponseHandler.success(res, batch, 'Batch created successfully', 201);
    } catch (error: any) {
      if (error instanceof BadRequestError || error instanceof AlreadyExistsError || error instanceof NotFoundError) {
        return ApiResponseHandler.error(res, error.message, (error instanceof NotFoundError || error.name === 'NotFoundError') ? 404 : ((error instanceof AlreadyExistsError || error.name === 'AlreadyExistsError') ? 409 : 400));
      }
      logger.error(`Error creating batch: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to create batch');
    }
  };

  public getBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      const batch = await this.batchService.getBatch(id);
      ApiResponseHandler.success(res, batch, 'Batch fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError || error.name === 'NotFoundError') {
        return ApiResponseHandler.notFound(res, error.message);
      }
      ApiResponseHandler.error(res, 'Failed to fetch batch');
    }
  };

  public getAllActiveBatches = async (req: Request, res: Response) => {
    try {
      const options = QueryBuilder.parse(req.query);
      const user = (req as any).user;

      if (!user) {
        return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const batches = await this.batchService.getAllActiveBatches(user, options);
      ApiResponseHandler.success(res, batches, 'Active batches fetched successfully');
    } catch (error: any) {
      if (error instanceof ForbiddenError || error.name === 'ForbiddenError') {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching active batches: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch active batches');
    }
  };

  public getBatchesByCourse = async (req: Request, res: Response) => {
    try {
      const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');
      const options = QueryBuilder.parse(req.query);

      if (req.query.active === 'true') {
        options.where = { ...options.where, isActive: true };
      }

      const user = (req as any).user;
      if (!user) {
        return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const batches = await this.batchService.getBatchesByCourse(courseId, user, options);
      ApiResponseHandler.success(res, batches, 'Batches fetched successfully');
    } catch (error: any) {
      logger.error(`Error fetching batches for course: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch batches');
    }
  };

  public updateBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      const batchData = plainToInstance(UpdateBatchDto, req.body);

      const batch = await this.batchService.updateBatch(id, batchData);
      ApiResponseHandler.success(res, batch, 'Batch updated successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) return ApiResponseHandler.notFound(res, error.message);
      if (error instanceof AlreadyExistsError) return ApiResponseHandler.error(res, error.message, 409);
      logger.error(`Error updating batch: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to update batch');
    }
  };

  public deleteBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      await this.batchService.deleteBatch(id);
      ApiResponseHandler.success(res, null, 'Batch deleted successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) return ApiResponseHandler.notFound(res, error.message);
      logger.error(`Error deleting batch: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to delete batch');
    }
  };

  // Batch User Operations

  public addUserToBatch = async (req: Request, res: Response) => {
    try {
      const { userId, batchId } = plainToInstance(AddUserToBatchDto, req.body);
      ValidationUtils.validateId(userId, 'User ID');
      ValidationUtils.validateId(batchId, 'Batch ID');

      const result = await this.batchService.addUserToBatch(userId, batchId);
      ApiResponseHandler.success(res, result, 'User added to batch successfully', 201);
    } catch (error: any) {
      if (error instanceof BadRequestError || error.name === 'BadRequestError') return ApiResponseHandler.error(res, error.message, 400);
      if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
      if (error instanceof AlreadyExistsError || error.name === 'AlreadyExistsError') return ApiResponseHandler.error(res, error.message, 409);
      logger.error(`Error adding user to batch: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to add user to batch');
    }
  };

  public removeUserFromBatch = async (req: Request, res: Response) => {
    try {
      const { userId, batchId } = plainToInstance(RemoveUserFromBatchDto, req.body);
      ValidationUtils.validateId(userId, 'User ID');
      ValidationUtils.validateId(batchId, 'Batch ID');

      await this.batchService.removeUserFromBatch(userId, batchId);
      ApiResponseHandler.success(res, null, 'User removed from batch successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
      logger.error(`Error removing user from batch: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to remove user from batch');
    }
  };


  public getBatchesByUser = async (req: Request, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
      const batches = await this.batchService.getBatchesByUser(userId);
      ApiResponseHandler.success(res, batches, 'User batches fetched successfully');
    } catch (error: any) {
      logger.error(`Error fetching user batches: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch user batches');
    }
  };

  public getUsersByBatch = async (req: Request, res: Response) => {
    try {
      const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
      const role = req.query.role as UserRole | undefined;

      if (role && !Object.values(UserRole).includes(role)) {
        return ApiResponseHandler.error(res, `Invalid role: ${role}`, 400);
      }

      const users = await this.batchService.getUsersByBatch(batchId, role);
      ApiResponseHandler.success(res, users, 'Batch users fetched successfully');
    } catch (error: any) {
      logger.error(`Error fetching batch users: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch batch users');
    }
  };

  public updateBatchUser = async (req: Request, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
      const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
      const { isActive } = plainToInstance(UpdateBatchUserDto, req.body);

      const updated = await this.batchService.updateBatchUser(batchId, userId, { isActive });
      ApiResponseHandler.success(res, updated, 'Batch user updated successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError || error.name === 'NotFoundError') return ApiResponseHandler.notFound(res, error.message);
      logger.error(`Error updating batch user: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to update batch user');
    }
  };
}

export const batchController = new BatchController(new BatchService());
