// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import { RegisterRequest, LoginRequest, AuthRequest, RefreshTokenRequest } from '../dtos/auth.dto';
import { plainToInstance } from 'class-transformer';

export const register = async (req: Request, res: Response) => {
    try {
        const data: RegisterRequest = req.body;
        const result = await AuthService.register(data);
        ApiResponseHandler.success(res, result, 'User registered successfully', 201);
    } catch (error: any) {
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
            ApiResponseHandler.error(res, 'Email already exists', 409);
        } else if (error.message === 'MOBILE_ALREADY_EXISTS') {
            ApiResponseHandler.error(res, 'Mobile already exists', 409);
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
        if (error.message === 'INVALID_CREDENTIALS') {
            ApiResponseHandler.error(res, 'Invalid email or password', 401);
        } else if (error.message === 'USER_INACTIVE') {
            ApiResponseHandler.error(res, 'User account is inactive', 403);
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
        if (error.message === 'INVALID_REFRESH_TOKEN') {
            ApiResponseHandler.error(res, 'Invalid refresh token', 401);
        } else if (error.message === 'REFRESH_TOKEN_REVOKED') {
            ApiResponseHandler.error(res, 'Refresh token has been revoked', 401);
        } else if (error.message === 'REFRESH_TOKEN_EXPIRED') {
            ApiResponseHandler.error(res, 'Refresh token has expired', 401);
        } else if (error.message === 'USER_INACTIVE') {
            ApiResponseHandler.error(res, 'User account is inactive', 403);
        } else {
            ApiResponseHandler.error(res, error.message || 'Error refreshing tokens', 500);
        }
    }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return ApiResponseHandler.error(res, 'User not found', 404);
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
