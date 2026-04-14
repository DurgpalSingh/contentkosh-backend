import { Response } from 'express';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from '../dtos/announcement.dto';
import type { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/api.errors';
import * as announcementRepo from '../repositories/announcement.repo';
import { announcementService } from '../services/announcement.service';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';

function parsePositiveId(raw: string | undefined, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Valid ${label} is required`);
  }
  return id;
}

export const getMyAnnouncements = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    logger.warn('[announcement] getMyAnnouncements missing user');
    throw new UnauthorizedError('Unauthorized');
  }
  logger.info(`[announcement] getMyAnnouncements request userId=${user.id}`);
  const data = await announcementService.getMyAnnouncements(user);
  logger.info(`[announcement] getMyAnnouncements response userId=${user.id} count=${data.length}`);
  ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
};

export const getManagedAnnouncements = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    logger.warn('[announcement] getManagedAnnouncements missing user');
    throw new UnauthorizedError('Unauthorized');
  }
  logger.info(`[announcement] getManagedAnnouncements request userId=${user.id}`);
  const data = await announcementService.getManagedAnnouncements(user);
  logger.info(`[announcement] getManagedAnnouncements response userId=${user.id} count=${data.length}`);
  ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
};

export const getUserAnnouncementBundle = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    logger.warn('[announcement] getUserAnnouncementBundle missing user');
    throw new UnauthorizedError('Unauthorized');
  }

  logger.info(`[announcement] getUserAnnouncementBundle request userId=${user.id}`);
  const data = await announcementService.getUserAnnouncementBundle(user);
  logger.info(
    `[announcement] getUserAnnouncementBundle response userId=${user.id} received=${data.received.length} managed=${data.managed.length}`,
  );
  ApiResponseHandler.success(res, data, 'Announcements fetched successfully');
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    logger.warn('[announcement] create missing user');
    throw new UnauthorizedError('Unauthorized');
  }
  const body = req.body as CreateAnnouncementDto;
  logger.info(`[announcement] create request userId=${user.id} scope=${body?.scope}`);
  const data = await announcementService.createAnnouncement(user, body);
  logger.info(`[announcement] create response id=${data.id} userId=${user.id}`);
  ApiResponseHandler.success(res, data, 'Announcement created successfully', 201);
};

export const getAnnouncementById = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user || user.businessId === null || user.businessId === undefined) {
    throw new UnauthorizedError('Unauthorized');
  }
  const id = parsePositiveId(req.params.id, 'Announcement ID');
  logger.info(`[announcement] getById request id=${id} userId=${user.id}`);
  const row = await announcementRepo.findAnnouncementByIdWithTargets(id, user.businessId);
  if (!row) {
    logger.warn(`[announcement] getById not found id=${id} businessId=${user.businessId}`);
    throw new NotFoundError('Announcement');
  }
  logger.info(`[announcement] getById success id=${id}`);
  ApiResponseHandler.success(res, row, 'Announcement fetched successfully');
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new UnauthorizedError('Unauthorized');
  }
  const id = parsePositiveId(req.params.id, 'Announcement ID');
  const body = req.body as UpdateAnnouncementDto;
  logger.info(`[announcement] update request id=${id} userId=${user.id}`);
  const data = await announcementService.updateAnnouncement(user, id, body);
  logger.info(`[announcement] update response id=${id} userId=${user.id}`);
  ApiResponseHandler.success(res, data, 'Announcement updated successfully');
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new UnauthorizedError('Unauthorized');
  }
  const id = parsePositiveId(req.params.id, 'Announcement ID');
  logger.info(`[announcement] delete request id=${id} userId=${user.id}`);
  await announcementService.deleteAnnouncement(user, id);
  logger.info(`[announcement] delete success id=${id} userId=${user.id}`);
  ApiResponseHandler.success(res, null, 'Announcement deleted successfully');
};
