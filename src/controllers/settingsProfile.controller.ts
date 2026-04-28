import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { SettingsProfileService } from '../services/settingsProfile.service';

const service = new SettingsProfileService();

export const getSettingsProfile = async (req: AuthRequest, res: Response) => {
  const currentUser = req.user!;
  const profile = await service.getProfile(currentUser);
  ApiResponseHandler.success(res, profile, 'Settings profile fetched successfully');
};

export const updateSettingsProfile = async (req: AuthRequest, res: Response) => {
  const currentUser = req.user!;
  const profile = await service.updateProfile(currentUser, req.body);
  ApiResponseHandler.success(res, profile, 'Settings profile updated successfully');
};
