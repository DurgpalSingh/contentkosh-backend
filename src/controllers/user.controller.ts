import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { UserRole, UserStatus } from '@prisma/client';
import * as userRepo from '../repositories/user.repo';
import * as businessRepo from '../repositories/business.repo';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';

// Admin adds user to business
export const createUserForBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestError('Valid Business ID is required');
  }

  const userData = plainToInstance(CreateUserDto, req.body);

  // Verify business exists
  const business = await businessRepo.findBusinessById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  try {
    // Build create object, only including mobile if defined
    const createData: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
      businessId: number;
      status: UserStatus;
      mobile?: string;
    } = {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      businessId,
      status: UserStatus.ACTIVE
    };
    if (userData.mobile !== undefined) createData.mobile = userData.mobile;

    const newUser = await userRepo.createUser(createData);

    logger.info(`User created for business ${businessId}: ${userData.email}`);
    ApiResponseHandler.success(res, newUser, 'User created successfully', 201);
  } catch (error: any) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      throw new AlreadyExistsError('User with this email already exists');
    }
    if (error.message === 'MOBILE_ALREADY_EXISTS') {
      throw new AlreadyExistsError('User with this mobile already exists');
    }
    throw error;
  }
};

export const getUsersByBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestError('Valid Business ID is required');
  }

  // Verify business exists
  const business = await businessRepo.findBusinessById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  const role = req.query.role as UserRole | undefined;

  const users = await userRepo.findByBusinessId(businessId, role);
  ApiResponseHandler.success(res, users, 'Business users fetched successfully');
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new BadRequestError('Valid User ID is required');
  }

  const userData = plainToInstance(UpdateUserDto, req.body);

  // Check if user exists
  const exists = await userRepo.exists(userId);
  if (!exists) {
    throw new NotFoundError('User not found');
  }

  // Build update object, only including defined properties
  const updateData: { name?: string; mobile?: string; role?: UserRole; status?: UserStatus } = {};
  if (userData.name !== undefined) updateData.name = userData.name;
  if (userData.mobile !== undefined) updateData.mobile = userData.mobile;
  if (userData.role !== undefined) updateData.role = userData.role;
  if (userData.status !== undefined) updateData.status = userData.status;

  const updatedUser = await userRepo.updateUser(userId, updateData);
  ApiResponseHandler.success(res, updatedUser, 'User updated successfully');
};

export const deleteUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new BadRequestError('Valid User ID is required');
  }

  const exists = await userRepo.exists(userId);
  if (!exists) {
    throw new NotFoundError('User not found');
  }

  await userRepo.softDeleteUser(userId);
  ApiResponseHandler.success(res, null, 'User deleted successfully');
};
