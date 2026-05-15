import { Response } from 'express';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../dtos/announcement.dto';
import type { AuthRequest } from '../dtos/auth.dto';
import { announcementService } from '../services/announcement.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import { parsePositiveId } from '../utils/announceUtils';
import logger from '../utils/logger';
import { handleControllerError } from '../utils/controllerErrorHandler';

export const getMyAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    logger.info(`[announcement] getMyAnnouncements request userId=${user.id}`);
    const data = await announcementService.getMyAnnouncements(user);
    logger.info(`[announcement] getMyAnnouncements response userId=${user.id} count=${data.length}`);
    ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to fetch announcements', 'Error fetching announcements');
  }
};

export const getManagedAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    logger.info(`[announcement] getManagedAnnouncements request userId=${user.id}`);
    const data = await announcementService.getManagedAnnouncements(user);
    logger.info(`[announcement] getManagedAnnouncements response userId=${user.id} count=${data.length}`);
    ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
  } catch (error: unknown) {
    handleControllerError(
      res,
      error,
      'Failed to fetch managed announcements',
      'Error fetching managed announcements',
    );
  }
};

export const getUserAnnouncementBundle = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    logger.info(`[announcement] getUserAnnouncementBundle request userId=${user.id}`);
    const data = await announcementService.getUserAnnouncementBundle(user);
    logger.info(
      `[announcement] getUserAnnouncementBundle response userId=${user.id} received=${data.received.length} managed=${data.managed.length}`,
    );
    ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to fetch announcements', 'Error fetching announcement bundle');
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const body = req.body as CreateAnnouncementDto;
    logger.info(`[announcement] create request userId=${user.id} scope=${body?.scope}`);
    const data = await announcementService.createAnnouncement(user, body);
    logger.info(`[announcement] create response id=${data.id} userId=${user.id}`);
    ApiResponseHandler.success(res, data, 'Announcement created successfully', 201);
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to create announcement', 'Error creating announcement');
  }
};

export const getAnnouncementById = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const announcementId = parsePositiveId(req.params.id, 'Announcement ID');
    logger.info(`[announcement] getById request id=${announcementId} userId=${user.id}`);
    const row = await announcementService.getAnnouncementByIdForUser(user, announcementId);
    logger.info(`[announcement] getById success id=${announcementId}`);
    ApiResponseHandler.success(res, row, 'Announcement fetched successfully');
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to fetch announcement', 'Error fetching announcement');
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = parsePositiveId(req.params.id, 'Announcement ID');
    const body = req.body as UpdateAnnouncementDto;
    logger.info(`[announcement] update request id=${id} userId=${user.id}`);
    const data = await announcementService.updateAnnouncement(user, id, body);
    logger.info(`[announcement] update response id=${id} userId=${user.id}`);
    ApiResponseHandler.success(res, data, 'Announcement updated successfully');
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to update announcement', 'Error updating announcement');
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = parsePositiveId(req.params.id, 'Announcement ID');
    logger.info(`[announcement] delete request id=${id} userId=${user.id}`);
    await announcementService.deleteAnnouncement(user, id);
    logger.info(`[announcement] delete success id=${id} userId=${user.id}`);
    ApiResponseHandler.success(res, null, 'Announcement deleted successfully');
  } catch (error: unknown) {
    handleControllerError(res, error, 'Failed to delete announcement', 'Error deleting announcement');
  }
};
