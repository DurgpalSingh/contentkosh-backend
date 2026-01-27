// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import { RegisterRequest, LoginRequest, AuthRequest, RefreshTokenRequest } from '../dtos/auth.dto';
import { plainToInstance } from 'class-transformer';
import { ApiError } from '../errors/api.errors';
import * as userService from '../services/user.service';

export const register = async (req: Request, res: Response) => {
    try {
        const data: RegisterRequest = req.body;
        const result = await AuthService.register(data);
        ApiResponseHandler.success(res, result, 'User registered successfully', 201);
    } catch (error: any) {
        if (error instanceof ApiError) {
            ApiResponseHandler.error(res, error.message, error.statusCode);
        } else {
            ApiResponseHandler.error(res, error.message || 'Error registering user', 500);
        }
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const data: LoginRequest = req.body;
        const result = await AuthService.login(data);
        ApiResponseHandler.success(res, result, 'Login successful');
    } catch (error: any) {
        if (error instanceof ApiError) {
            ApiResponseHandler.error(res, error.message, error.statusCode);
        } else {
            ApiResponseHandler.error(res, error.message || 'Error logging in', 500);
        }
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    try {
        const data = plainToInstance(RefreshTokenRequest, req.body);
        const result = await AuthService.refreshTokens(data.refreshToken);
        ApiResponseHandler.success(res, result, 'Tokens refreshed successfully');
    } catch (error: any) {
        if (error instanceof ApiError) {
            ApiResponseHandler.error(res, error.message, error.statusCode);
        } else {
            ApiResponseHandler.error(res, error.message || 'Error refreshing tokens', 500);
        }
    }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const tokenUser = req.user;
        if (!tokenUser) {
            return ApiResponseHandler.error(res, 'User not found', 404);
        }

        // Fetch full user details from database
        const user = await userService.findUserById(tokenUser.id);
        if (!user) {
            return ApiResponseHandler.error(res, 'User not found in database', 404);
        }

        ApiResponseHandler.success(res, user, 'Profile fetched successfully');
    } catch (error: any) {
        ApiResponseHandler.error(res, error.message || 'Error fetching profile', 500);
    }
}

export const logout = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await AuthService.logout(refreshToken);
        }
        ApiResponseHandler.success(res, null, 'Logout successful');
    } catch (error: any) {
        // Always return success for logout - user should be logged out regardless
        ApiResponseHandler.success(res, null, 'Logout successful');
    }
}
