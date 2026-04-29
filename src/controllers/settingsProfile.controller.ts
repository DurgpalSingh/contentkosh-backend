import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { SettingsProfileService } from '../services/settingsProfile.service';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import logger from '../utils/logger';

const service = new SettingsProfileService();

export const getSettingsProfile = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const profile = await service.getProfile(currentUser);
    ApiResponseHandler.success(res, profile, 'Settings profile fetched successfully');
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return ApiResponseHandler.notFound(res, error.message);
    }
    logger.error(`Error fetching settings profile: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to fetch settings profile');
  }
};

export const updateSettingsProfile = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const profile = await service.updateProfile(currentUser, req.body);
    ApiResponseHandler.success(res, profile, 'Settings profile updated successfully');
  } catch (error: any) {
    if (error instanceof BadRequestError) {
      return ApiResponseHandler.error(res, error.message, 400);
    }
    if (error instanceof NotFoundError) {
      return ApiResponseHandler.notFound(res, error.message);
    }
    if (error instanceof ForbiddenError) {
      return ApiResponseHandler.error(res, error.message, 403);
    }
    logger.error(`Error updating settings profile: ${error.message}`);
    ApiResponseHandler.error(res, 'Failed to update settings profile');
  }
};
