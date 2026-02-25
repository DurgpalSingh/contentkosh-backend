import { UserRole } from '@prisma/client';
import * as dashboardRepo from '../repositories/dashboard.repo';
import { IUser } from '../dtos/auth.dto';
import { BadRequestError, ForbiddenError } from '../errors/api.errors';
import logger from '../utils/logger';

export const getDashboardByRole = async (user: IUser) => {
    if (!user.businessId) {
        throw new BadRequestError('Business ID is required');
    }

    logger.info(`Fetching dashboard for user ${user.id} with role ${user.role}`);

    let dashboardData;

    switch (user.role) {
        case UserRole.ADMIN:
        case UserRole.SUPERADMIN:
            dashboardData = await dashboardRepo.getAdminDashboardData(user.businessId);
            break;
        
        case UserRole.TEACHER:
            dashboardData = await dashboardRepo.getTeacherDashboardData(user.businessId, user.id);
            break;
        
        case UserRole.STUDENT:
            dashboardData = await dashboardRepo.getStudentDashboardData(user.businessId, user.id);
            break;
        
        default:
            logger.warn(`Unsupported role ${user.role} for dashboard access by user ${user.id}`);
            throw new ForbiddenError('Dashboard not available for your role');
    }

    logger.info(`Dashboard fetched successfully for user ${user.id}`);
    return dashboardData;
};
