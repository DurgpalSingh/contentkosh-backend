import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { UserRole } from '@prisma/client';
import * as userService from '../services/user.service';
import { BadRequestError } from '../errors/api.errors';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';

// Admin adds user to business
export const createUserForBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestError('Valid Business ID is required');
  }

  const userData = plainToInstance(CreateUserDto, req.body);
  const newUser = await userService.createUserForBusiness(businessId, userData);

  logger.info(`User created for business ${businessId}: ${userData.email}`);
  ApiResponseHandler.success(res, newUser, 'User created successfully', 201);
};

export const getUsersByBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestError('Valid Business ID is required');
  }

  const role = req.query.role as UserRole | undefined;

  const users = await userService.getUsersByBusiness(businessId, role);
  ApiResponseHandler.success(res, users, 'Business users fetched successfully');
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new BadRequestError('Valid User ID is required');
  }

  const userData = plainToInstance(UpdateUserDto, req.body);
  const updatedUser = await userService.updateUser(userId, userData);

  ApiResponseHandler.success(res, updatedUser, 'User updated successfully');
};

export const deleteUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new BadRequestError('Valid User ID is required');
  }

  await userService.deleteUser(userId);
  ApiResponseHandler.success(res, null, 'User deleted successfully');
};
