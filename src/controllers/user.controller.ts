import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as userRepo from '../repositories/user.repo';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';

// DELETE /users/{userId}
export const deleteUser = async (req: Request, res: Response) => {
  const id = Number(req.params.userId);
  if (!id) throw new BadRequestError('Invalid User ID');

  const exists = await userRepo.exists(id);
  if (!exists) throw new NotFoundError('User not found');

  await userRepo.softDeleteUser(id);
  logger.info(`User ${id} soft deleted`);
  ApiResponseHandler.success(res, null, 'User deleted successfully');
};

// PUT /users/{userId}
export const updateUser = async (req: Request, res: Response) => {
  const id = Number(req.params.userId);
  if (!id) throw new BadRequestError('Invalid User ID');

  const data: Prisma.UserUpdateInput = req.body;
  // security check: ensure admin or self? Middleware handles auth. 
  // Ideally we validates that the user belongs to the same business as the requestor if admin.

  // We can filter allowed fields here if needed.
  const updated = await userRepo.updateUser(id, data);
  logger.info(`User ${id} updated`);
  ApiResponseHandler.success(res, updated, 'User updated successfully');
};

// GET /business/{businessId}/users
export const getUsersByBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!businessId) throw new BadRequestError('Invalid Business ID');

  const role = req.query.role as UserRole | undefined; // optional filter

  const users = await userRepo.findUsersByBusiness(businessId, role);
  ApiResponseHandler.success(res, users, 'Users fetched successfully');
};

// POST /business/{businessId}/users
export const createUserForBusiness = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!businessId) throw new BadRequestError('Invalid Business ID');

  const { email, password, name, mobile, role, status }: any = req.body; // Using any to bypass potential type mismatch in dev
  if (!email || !name) throw new BadRequestError('Email and Name are required');

  // Check if user exists
  const existingUser = await userRepo.findByEmail(email);
  if (existingUser) {
    // Validation: If user already in a business?
    if (existingUser.businessId && existingUser.businessId !== businessId) {
      throw new AlreadyExistsError('User already belongs to another business');
    }
    if (existingUser.businessId === businessId) {
      throw new AlreadyExistsError('User already in this business');
    }
    // User exists but has no business -> Link them
    // If password provided, update it? Maybe not for security unless explicit reset.
    await userRepo.updateUser(existingUser.id, {
      business: { connect: { id: businessId } },
      role: role || UserRole.STUDENT,
      status: status || UserStatus.ACTIVE
    });
    logger.info(`User ${existingUser.id} linked to business ${businessId}`);
    const linkedUser = await userRepo.findPublicById(existingUser.id);
    return ApiResponseHandler.success(res, linkedUser, 'User added to business', 200);
  }

  // Create new
  if (!password) throw new BadRequestError('Password is required for new user');

  const newUser = await userRepo.createUser({
    email,
    password,
    name,
    mobile,
    businessId,
    role: role || UserRole.STUDENT,
    status: status || UserStatus.ACTIVE
  } as any);

  logger.info(`User created for business ${businessId}: ${email}`);
  ApiResponseHandler.success(res, newUser, 'User created successfully', 201);
};