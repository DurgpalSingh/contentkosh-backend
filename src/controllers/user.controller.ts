import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { UserRole } from '@prisma/client';
import * as userService from '../services/user.service';
import { BadRequestError } from '../errors/api.errors';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';

// Helper to validate and parse ID
const validateId = (id: any, name: string): number => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new BadRequestError(`Valid ${name} is required`);
  }
  return parsedId;
};

// Admin adds user to business
export const createUserForBusiness = async (req: Request, res: Response) => {
  const businessId = validateId(req.params.businessId, 'Business ID');

  const userData = plainToInstance(CreateUserDto, req.body);
  const newUser = await userService.createUserForBusiness(businessId, userData);

  logger.info(`User created for business ${businessId}: ${userData.email}`);
  ApiResponseHandler.success(res, newUser, 'User created successfully', 201);
};

export const getUsersByBusiness = async (req: Request, res: Response) => {
  const businessId = validateId(req.params.businessId, 'Business ID');


  const role = req.query.role as UserRole | undefined;
  if (role && !Object.values(UserRole).includes(role)) {
    throw new BadRequestError('Invalid role');
  }

  const users = await userService.getUsersByBusiness(businessId, role);
  ApiResponseHandler.success(res, users, 'Business users fetched successfully');
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = validateId(req.params.userId, 'User ID');

  const userData = plainToInstance(UpdateUserDto, req.body);
  const updatedUser = await userService.updateUser(userId, userData);

  ApiResponseHandler.success(res, updatedUser, 'User updated successfully');
};

export const deleteUser = async (req: Request, res: Response) => {
  const userId = validateId(req.params.userId, 'User ID');

  await userService.deleteUser(userId);
  ApiResponseHandler.success(res, null, 'User deleted successfully');
};
