import { Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { requestContext } from '../contexts/request-context';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthService } from '../services/auth.service';
import { AuthRequest, IUser } from '../dtos/auth.dto';
import { UserRole } from '@prisma/client';
import { ApiError } from '../errors/api.errors';
import { getAccessTokenFromRequest } from '../utils/authCookies';
import * as businessRepo from '../repositories/business.repo';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = getAccessTokenFromRequest(req);
        if (!token) {
            ApiResponseHandler.unauthorized(res, 'No token provided');
            return;
        }

        const iuser = AuthService.verifyAccessToken(token);
        if (!iuser) {
            ApiResponseHandler.unauthorized(res, 'Invalid or expired token');
            return;
        }

        const userContext: IUser = {
            ...iuser,
        };

        const tenantBusinessId = userContext.businessId ?? null;
        let tenant = undefined;

        if (tenantBusinessId != null) {
            const business = await businessRepo.findBusinessById(tenantBusinessId);
            if (business?.schemaName) {
                    tenant = {
                        businessId: business.id,
                        ...(business.slug ? { slug: business.slug } : {}),
                        schemaName: business.schemaName,
                    };
                userContext.businessSlug = business.slug ?? null;
                userContext.tenantSchema = business.schemaName;
            }
        } else if (userContext.tenantSchema) {
            tenant = {
                ...(userContext.businessId ? { businessId: userContext.businessId } : {}),
                ...(userContext.businessSlug ? { slug: userContext.businessSlug } : {}),
                schemaName: userContext.tenantSchema,
            };
        }

        requestContext.run({ user: userContext, tenant }, () => {
            req.user = userContext;
            next();
        });

    } catch (error) {
        if (error instanceof ApiError) {
            ApiResponseHandler.error(res, error.message, error.statusCode);
        } else {
            logger.error('Authentication error:', error);
            ApiResponseHandler.error(res, 'Authentication error', 401);
        }
    }
};

export const authorize = (...roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return ApiResponseHandler.error(res, 'Unauthorized', 401);
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return ApiResponseHandler.error(res, 'Forbidden', 403);
        }
        next();
    }
}
