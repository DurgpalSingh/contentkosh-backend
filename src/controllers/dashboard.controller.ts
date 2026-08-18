import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import * as dashboardService from '../services/dashboard.service';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';

export const getDashboard = async (req: AuthRequest, res: Response) => {
    try {
    if (!req.user) {
        return ApiResponseHandler.error(res, 'Unauthorized', 401);
    }

    logger.info(`Dashboard request from user ${req.user.id} with role ${req.user.role}`);

    const dashboard = await dashboardService.getDashboardByRole(req.user);

    ApiResponseHandler.success(res, dashboard, 'Dashboard data fetched successfully');
    } catch (error) {
        handleControllerError(res, error, 'Failed to fetch dashboard', 'Error fetching dashboard');
    }
};
