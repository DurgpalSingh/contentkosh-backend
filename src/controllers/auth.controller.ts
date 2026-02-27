// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import { RegisterRequest, LoginRequest, AuthRequest } from '../dtos/auth.dto';
import { ApiError } from '../errors/api.errors';
import * as userService from '../services/user.service';
import { clearAuthCookies, getRefreshTokenFromRequest, setAuthCookies } from '../utils/authCookies';

export const register = async (req: Request, res: Response) => {
    try {
        const data: RegisterRequest = req.body;
        const result = await AuthService.register(data);
        setAuthCookies(res, result.accessToken, result.refreshToken);
        ApiResponseHandler.success(res, result.user, 'User registered successfully', 201);
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
        setAuthCookies(res, result.accessToken, result.refreshToken);
        ApiResponseHandler.success(res, result.user, 'Login successful');
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
        const refreshTokenValue = getRefreshTokenFromRequest(req);
        if (!refreshTokenValue) {
            ApiResponseHandler.unauthorized(res, 'Refresh token is required');
            return;
        }

        const result = await AuthService.refreshTokens(refreshTokenValue);
        setAuthCookies(res, result.accessToken, result.refreshToken);
        ApiResponseHandler.success(res, result.user, 'Tokens refreshed successfully');
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
        const refreshTokenValue = getRefreshTokenFromRequest(req);
        if (refreshTokenValue) {
            await AuthService.logout(refreshTokenValue);
        }
        clearAuthCookies(res);
        ApiResponseHandler.success(res, null, 'Logout successful');
    } catch (error) {
        // Always return success for logout - user should be logged out regardless
        clearAuthCookies(res);
        ApiResponseHandler.success(res, null, 'Logout successful');
    }
}
