import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateBatchDto, UpdateBatchDto, AddUserToBatchDto, RemoveUserFromBatchDto, UpdateBatchUserDto, SelfEnrollBatchDto } from '../dtos/batch.dto';
import { BatchService } from '../services/batch.service';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';

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
    } catch (error) {
      handleControllerError(res, error, 'Failed to create batch', 'Error creating batch');
    }
  };

  public getBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      const batch = await this.batchService.getBatch(id);
      ApiResponseHandler.success(res, batch, 'Batch fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch batch', 'Error fetching batch');
    }
  };

  public getAllActiveBatches = async (req: Request, res: Response) => {
    try {
      const queryParams  = req.query;
      const user = (req as AuthRequest).user!;

      const batches = await this.batchService.getAllActiveBatches(user, queryParams);
      ApiResponseHandler.success(res, batches, 'Active batches fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch active batches', 'Error fetching active batches');
    }
  };

  public getBrowsableBatches = async (req: Request, res: Response) => {
    try {
      const user = (req as AuthRequest).user!;
      const batches = await this.batchService.getBrowsableBatches(user);
      ApiResponseHandler.success(res, batches, 'Browsable batches fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch browsable batches', 'Error fetching browsable batches');
    }
  };

  public getBatchesByCourse = async (req: Request, res: Response) => {
    try {
      const courseId = ValidationUtils.validateId(req.params.courseId, 'Course ID');
      const queryParams  = req.query;
      const user = (req as AuthRequest).user!;
      const batches = await this.batchService.getBatchesByCourse(courseId, user,  queryParams);
      ApiResponseHandler.success(res, batches, 'Batches fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch batches', 'Error fetching batches for course');
    }
  };

  public updateBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      const batchData = plainToInstance(UpdateBatchDto, req.body);

      const batch = await this.batchService.updateBatch(id, batchData);
      ApiResponseHandler.success(res, batch, 'Batch updated successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to update batch', 'Error updating batch');
    }
  };

  public deleteBatch = async (req: Request, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.id, 'Batch ID');
      await this.batchService.deleteBatch(id);
      ApiResponseHandler.success(res, null, 'Batch deleted successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to delete batch', 'Error deleting batch');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to add user to batch', 'Error adding user to batch');
    }
  };

  public selfEnrollInBatch = async (req: Request, res: Response) => {
    try {
      const { batchId } = plainToInstance(SelfEnrollBatchDto, req.body);
      ValidationUtils.validateId(batchId, 'Batch ID');
      const user = (req as AuthRequest).user!;

      const result = await this.batchService.selfEnrollInBatch(user, batchId);
      ApiResponseHandler.success(res, result, 'Enrolled successfully', 201);
    } catch (error) {
      handleControllerError(res, error, 'Failed to enroll in batch', 'Error self-enrolling in batch');
    }
  };

  public removeUserFromBatch = async (req: Request, res: Response) => {
    try {
      const { userId, batchId } = plainToInstance(RemoveUserFromBatchDto, req.body);
      ValidationUtils.validateId(userId, 'User ID');
      ValidationUtils.validateId(batchId, 'Batch ID');

      await this.batchService.removeUserFromBatch(userId, batchId);
      ApiResponseHandler.success(res, null, 'User removed from batch successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to remove user from batch', 'Error removing user from batch');
    }
  };


  public getBatchesByUser = async (req: Request, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
      const batches = await this.batchService.getBatchesByUser(userId);
      ApiResponseHandler.success(res, batches, 'User batches fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch user batches', 'Error fetching user batches');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch batch users', 'Error fetching batch users');
    }
  };

  public updateBatchUser = async (req: Request, res: Response) => {
    try {
      const userId = ValidationUtils.validateId(req.params.userId, 'User ID');
      const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
      const { isActive } = plainToInstance(UpdateBatchUserDto, req.body);

      const updated = await this.batchService.updateBatchUser(batchId, userId, { isActive });
      ApiResponseHandler.success(res, updated, 'Batch user updated successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to update batch user', 'Error updating batch user');
    }
  };
}

export const batchController = new BatchController(new BatchService());
