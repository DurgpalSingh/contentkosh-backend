import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import * as dashboardService from '../services/dashboard.service';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/api.errors';

export const getDashboard = async (req: AuthRequest, res: Response) => {
    try {
    if (!req.user) {
        return ApiResponseHandler.error(res, 'Unauthorized', 401);
    }

    logger.info(`Dashboard request from user ${req.user.id} with role ${req.user.role}`);

    const dashboard = await dashboardService.getDashboardByRole(req.user);

    ApiResponseHandler.success(res, dashboard, 'Dashboard data fetched successfully');
    } catch (error: any) {
        if (error instanceof BadRequestError) {
        return ApiResponseHandler.error(res, error.message, 400);
      }
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.error(res, error.message, 404);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching dashboard: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch dashboard');
    }
};
