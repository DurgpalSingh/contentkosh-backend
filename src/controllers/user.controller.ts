import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthService } from '../services/auth.service';
import logger from '../utils/logger';
import { Prisma, UserRole } from '@prisma/client';
import * as userRepo from '../repositories/user.repo';
import * as businessRepo from '../repositories/business.repo';
import * as businessUserRepo from '../repositories/businessUser.repo';
import { IUser, LoginDto, AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name }: Prisma.UserCreateInput = req.body;

    // Validate input
    if (!email || !password || !name) {
      return ApiResponseHandler.error(res, 'Email, password, and name are required', 400);
    }

    // Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return ApiResponseHandler.error(res, 'User with this email already exists', 409);
    }

    // Create user in database
    const user = await userRepo.createUser({ email, password: password, name });


    logger.info(`User registered successfully: ${email}`);

    ApiResponseHandler.success(res, user, 'User registered successfully');

  } catch (error) {
    logger.error('Error registering user:', error);
    ApiResponseHandler.error(res, 'Error registering user', 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginDto = req.body;

    // Validate input
    if (!email || !password) {
      return ApiResponseHandler.error(res, 'Email and password are required', 400);
    }

    // Check if user exists
    const user = await userRepo.findByEmailWithBusinesses(email);
    if (!user) {
      return ApiResponseHandler.error(res, 'Invalid email or password', 401);
    }

    // Verify password
    const isValidPassword = await AuthService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return ApiResponseHandler.error(res, 'Invalid email or password', 401);
    }

    const iuser: IUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      businessId: user.businessUsers?.[0]?.business.id ?? -1,
      role: user.businessUsers?.[0]?.role || UserRole.GUEST
    };

    // Generate JWT token
    const token = AuthService.generateToken(iuser);

    logger.info(`User logged in successfully: ${email}`);

    ApiResponseHandler.success(res, {
      user: iuser,
      token
    }, 'Login successful');
  } catch (error) {
    logger.error('Error during login:', error);
    ApiResponseHandler.error(res, 'Error during login', 500);
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ApiResponseHandler.error(res, 'User not authenticated', 401);
    }

    // Get user profile from database
    const user = await userRepo.findPublicById(userId);
    if (!user) {
      return ApiResponseHandler.error(res, 'User not found', 404);
    }

    logger.info(`Profile fetched for user ${userId}`);

    ApiResponseHandler.success(res, user, 'Profile fetched successfully');

  } catch (error) {
    logger.error('Error fetching profile:', error);
    ApiResponseHandler.error(res, 'Error fetching profile', 500);
  }
};

// ==================== BUSINESS USER FUNCTIONS ====================

export const assignUserToBusiness = async (req: Request, res: Response) => {
  const { userId, businessId, role }: { userId: number; businessId: number; role: UserRole } = req.body;

  // Validate input
  if (!userId || !businessId || !role) {
    throw new BadRequestError('User ID, Business ID, and role are required');
  }

  // Check if user exists
  const user = await userRepo.findPublicById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if business exists
  const business = await businessRepo.findBusinessById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }

  // Check if user is already assigned to this business
  const existingAssignment = await businessUserRepo.findBusinessUserByUserAndBusiness(userId, businessId);
  if (existingAssignment) {
    throw new AlreadyExistsError('User is already assigned to this business');
  }

  const businessUser = await businessUserRepo.createBusinessUser({
    user: { connect: { id: userId } },
    business: { connect: { id: businessId } },
    role
  });

  logger.info(`User ${userId} assigned to business ${businessId} with role ${role}`);

  ApiResponseHandler.success(res, businessUser, 'User assigned to business successfully', 201);
};

export const getUserBusinesses = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const businessUsers = await businessUserRepo.findBusinessUsersByUserId(userId);

  logger.info(`Business associations fetched for user ${userId}`);

  ApiResponseHandler.success(res, businessUsers, 'User business associations fetched successfully');
};

export const getBusinessUsers = async (req: Request, res: Response) => {
  const businessId = Number(req.params.businessId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestError('Valid Business ID is required');
  }

  const role = req.query.role as UserRole | undefined;

  let businessUsers;
  if (role) {
    businessUsers = await businessUserRepo.findBusinessUsersByRole(businessId, role);
  } else {
    businessUsers = await businessUserRepo.findBusinessUsersByBusinessId(businessId);
  }

  logger.info(`Business users fetched for business ${businessId}`);

  ApiResponseHandler.success(res, businessUsers, 'Business users fetched successfully');
};

export const getBusinessUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('Valid Business User ID is required');
  }

  const businessUser = await businessUserRepo.findBusinessUserById(id);
  if (!businessUser) {
    throw new NotFoundError('Business user not found');
  }

  logger.info(`Business user ${id} fetched successfully`);

  ApiResponseHandler.success(res, businessUser, 'Business user fetched successfully');
};

export const updateBusinessUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('Valid Business User ID is required');
  }

  const { role, isActive }: { role?: UserRole; isActive?: boolean } = req.body;

  const businessUser = await businessUserRepo.updateBusinessUser(id, { role: role || UserRole.GUEST, isActive: isActive || true });

  logger.info(`Business user ${id} updated successfully`);

  ApiResponseHandler.success(res, businessUser, 'Business user updated successfully');
};

export const removeUserFromBusiness = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('Valid Business User ID is required');
  }

  await businessUserRepo.deleteBusinessUser(id);

  logger.info(`Business user ${id} removed successfully`);

  ApiResponseHandler.success(res, null, 'User removed from business successfully');
}; 