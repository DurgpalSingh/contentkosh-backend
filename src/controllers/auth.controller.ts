// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import { RegisterRequest, LoginRequest, AuthRequest, VerifyEmailRequest, ResendVerificationRequest } from '../dtos/auth.dto';
import { resendVerificationEmail } from '../services/emailVerification.service';
import { EMAIL_VERIFICATION_MESSAGES } from '../constants/emailVerification.constants';
import * as userService from '../services/user.service';
import { clearAuthCookies, getRefreshTokenFromRequest, setAuthCookies } from '../utils/authCookies';
import { handleControllerError } from '../utils/controllerErrorHandler';

export const register = async (req: Request, res: Response) => {
    try {
        const data: RegisterRequest = req.body;
        const result = await AuthService.register(data);
        // No cookies: the account cannot log in until the emailed link is opened.
        ApiResponseHandler.success(res, result, EMAIL_VERIFICATION_MESSAGES.SIGNUP_SUCCESS, 201);
    } catch (error) {
        handleControllerError(res, error, 'Error registering user', 'Error registering user');
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token }: VerifyEmailRequest = req.body;
        const { tokens, ...result } = await AuthService.verifyEmail(token);
        if (tokens) {
            setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
        }
        ApiResponseHandler.success(res, result, EMAIL_VERIFICATION_MESSAGES.VERIFIED);
    } catch (error) {
        handleControllerError(res, error, 'Error verifying email', 'Error verifying email');
    }
};

export const resendVerification = async (req: Request, res: Response) => {
    try {
        const { email }: ResendVerificationRequest = req.body;
        await resendVerificationEmail(email);
        // Same answer whether or not the account exists, is verified, or is cooling down.
        ApiResponseHandler.success(res, null, EMAIL_VERIFICATION_MESSAGES.RESEND_GENERIC);
    } catch (error) {
        handleControllerError(res, error, 'Error resending verification email', 'Error resending verification email');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const data: LoginRequest = req.body;
        const result = await AuthService.login(data);
        setAuthCookies(res, result.accessToken, result.refreshToken);
        ApiResponseHandler.success(res, result.user, 'Login successful');
    } catch (error) {
        handleControllerError(res, error, 'Error logging in', 'Error logging in');
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
    } catch (error) {
        handleControllerError(res, error, 'Error refreshing tokens', 'Error refreshing tokens');
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

        // The token's role/businessId reflect the active session (which can differ from the
        // DB row while a Super Admin is impersonating a business) - overlay them so the
        // frontend hydrates the impersonated context rather than the real one.
        const responseUser = {
            ...user,
            role: tokenUser.role,
            businessId: tokenUser.businessId,
            isImpersonating: user.role !== tokenUser.role,
        };

        ApiResponseHandler.success(res, responseUser, 'Profile fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Error fetching profile', 'Error fetching profile');
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
