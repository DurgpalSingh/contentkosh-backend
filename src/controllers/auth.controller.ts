import { Request, Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthService } from '../services/auth.service';
import logger from '../utils/logger';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as userRepo from '../repositories/user.repo';
import { IUser, LoginDto, USER, AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../errors/api.errors';

export const signup = async (req: Request, res: Response) => {
    // 1. Validate
    const { email, password, name, mobile }: Prisma.UserCreateInput = req.body;
    if (!email || !password || !name) {
        throw new BadRequestError('Email, password, and name are required');
    }

    // 3. Create
    const user = await userRepo.createUser({
        email,
        password,
        name,
        mobile,
        role: USER, // from dto
        status: UserStatus.ACTIVE
    } as any); // Casting because of potential type mismatch during dev

    logger.info(`User signed up: ${email}`);

    // 4. Response
    ApiResponseHandler.success(res, user, 'Signup successful', 201);
};

export const login = async (req: Request, res: Response) => {
    const { email, password }: LoginDto = req.body;
    if (!email || !password) throw new BadRequestError('Email and password required');

    // 1. Find User
    const user = await userRepo.findByEmailWithBusinesses(email);
    if (!user) throw new BadRequestError('Invalid credentials');

    // 2. Verify Password
    const isValid = await AuthService.verifyPassword(password, user.password); // user.password is the hash
    if (!isValid) throw new BadRequestError('Invalid credentials');

    // 3. Check Status
    if (user.status !== UserStatus.ACTIVE) {
        throw new BadRequestError('User account is inactive');
    }

    // 4. Generate Token
    const iuser: IUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        businessId: user.businessId ?? undefined,
        role: user.role
    };
    const token = AuthService.generateToken(iuser);

    logger.info(`User logged in: ${email}`);
    ApiResponseHandler.success(res, { user: iuser, token }, 'Login successful');
};

export const logout = async (req: Request, res: Response) => {
    // Client side handles token removal. Server just confirms.
    ApiResponseHandler.success(res, null, 'Logged out successfully');
};

export const me = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestError('Not authenticated');

    const user = await userRepo.findPublicById(userId);
    if (!user) throw new NotFoundError('User not found');

    ApiResponseHandler.success(res, user, 'Profile fetched');
};
