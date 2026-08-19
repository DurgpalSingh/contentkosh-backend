import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { SettingsProfileService } from '../services/settingsProfile.service';
import { handleControllerError } from '../utils/controllerErrorHandler';

const service = new SettingsProfileService();

export const getSettingsProfile = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const profile = await service.getProfile(currentUser);
    ApiResponseHandler.success(res, profile, 'Settings profile fetched successfully');
  } catch (error) {
    handleControllerError(res, error, 'Failed to fetch settings profile', 'Error fetching settings profile');
  }
};

export const updateSettingsProfile = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user!;
    const profile = await service.updateProfile(currentUser, req.body);
    ApiResponseHandler.success(res, profile, 'Settings profile updated successfully');
  } catch (error) {
    handleControllerError(res, error, 'Failed to update settings profile', 'Error updating settings profile');
  }
};
