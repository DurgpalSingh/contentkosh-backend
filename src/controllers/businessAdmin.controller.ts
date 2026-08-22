import { Response, NextFunction } from 'express';
import { BusinessStatus } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError } from '../errors/api.errors';
import { BusinessAdminService } from '../services/businessAdmin.service';
import { AuthRequest } from '../dtos/auth.dto';
import { UpdateBusinessStatusDto } from '../dtos/businessAdmin.dto';

function getBusinessIdFromParams(req: AuthRequest): number {
  const id = Number(req.params.id);
  if (Number.isInteger(id) && id > 0) {
    return id;
  }
  throw new BadRequestError('Business ID is required');
}

export const listBusinesses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, search } = req.query;

    const result = await BusinessAdminService.listBusinesses({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status ? (status as BusinessStatus) : undefined,
      search: search ? String(search) : undefined,
    });

    ApiResponseHandler.successWithExtraProps(
      res,
      result.items,
      { pagination: result.pagination },
      'Businesses fetched successfully'
    );
  } catch (error) {
    logger.error(`Error listing businesses: ${error}`);
    next(error);
  }
};

export const getBusinessDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = getBusinessIdFromParams(req);
    const business = await BusinessAdminService.getBusinessDetail(id);
    ApiResponseHandler.success(res, business, 'Business fetched successfully');
  } catch (error) {
    logger.error(`Error fetching business with ID ${req.params.id}: ${error}`);
    next(error);
  }
};

export const updateBusinessStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = getBusinessIdFromParams(req);
    const { status, reason } = req.body as UpdateBusinessStatusDto;
    const actorId = req.user!.id;

    logger.info(`Super Admin ${actorId} setting business ${id} status to ${status}`);
    const business = await BusinessAdminService.updateStatus(id, actorId, status, reason);

    ApiResponseHandler.success(res, business, 'Business status updated successfully');
  } catch (error) {
    logger.error(`Error updating status for business ${req.params.id}: ${error}`);
    next(error);
  }
};
