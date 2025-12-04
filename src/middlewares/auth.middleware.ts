import { Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { requestContext } from '../contexts/request-context';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthService } from '../services/auth.service';
import * as userRepo from '../repositories/user.repo';
import { AuthRequest, IUser } from '../dtos/auth.dto';
import { UserRole } from '@prisma/client';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'No token provided'
            });
            return;
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'No token provided'
            });
            return;
        }
        
        // Validate token
        const iuser = AuthService.verifyToken(token);
        if (!iuser) {
            res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
            return;
        }

        // Get user from database
        if (! (await userRepo.exists(iuser.id))) {
            res.status(401).json({
                success: false,
                message: 'User not found'
            });
            return;
        }

        const userContext: IUser = {
            ...iuser,
        };

        requestContext.run({ user: userContext }, () => {
            req.user = userContext;
            next();
        });

    } catch (error: any) {
        logger.error('Authentication error:', error);
        ApiResponseHandler.error(res, `Authentication error: ${error.message}`, 401);
    }
}; 

export const authorize = (...roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }
        if (!roles.includes(req.user.role)) {
            return ApiResponseHandler.error(res, 'Forbidden', 403);
        }
        next();
    }
}
