import { Request, Response, NextFunction } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError } from '../errors/api.errors';
import { BusinessService } from '../services/business.service';
import { AuthRequest } from '../dtos/auth.dto';
import { CreateBusinessDto, UpdateBusinessDto } from '../dtos/business.dto';

export const createBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { instituteName, slug, logo_url, phone, email, ...otherData } = req.body as CreateBusinessDto;
    const user = req.user;

    if (!user) {
      throw new BadRequestError('User context required');
    }

    // Map incoming fields to DB fields
    const businessData = {
      instituteName,
      slug,
      logo: logo_url ?? null,
      contactNumber: phone ?? null,
      email: email ?? null,
      ...otherData
    };

    const business = await BusinessService.createBusiness(businessData, user.id);

    logger.info(`Business created successfully: ${business.instituteName}`);

    ApiResponseHandler.success(res, business, 'Business created successfully', 201);
  } catch (error) {
    next(error);
  }
};

function getBusinessIdFromRequest(req: Request): number {
  const id = Number(req.params.id);
  if (Number.isInteger(id) && id > 0) {
    return id;
  }
  throw new BadRequestError('Business ID is required');
}

export const getBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getBusinessIdFromRequest(req);
    const business = await BusinessService.getBusinessById(id);

    logger.info(`Business fetched successfully: ${business.instituteName}`);
    ApiResponseHandler.success(res, business, 'Business fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getBusinessBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      throw new BadRequestError('Slug is required');
    }
    const business = await BusinessService.getBusinessBySlug(slug);
    logger.info(`Business fetched successfully: ${business.instituteName}`);
    ApiResponseHandler.success(res, business, 'Business fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const updateBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = getBusinessIdFromRequest(req);
    const { logo_url, phone, ...otherData } = req.body;

    const updateData = {
      ...otherData,
      ...(logo_url && { logo: logo_url }),
      ...(phone && { contactNumber: phone })
    };

    const business = await BusinessService.updateBusiness(id, updateData);

    logger.info(`Business updated successfully: ${business.instituteName}`);

    ApiResponseHandler.success(res, business, 'Business updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = getBusinessIdFromRequest(req);
    await BusinessService.deleteBusiness(id);
    ApiResponseHandler.success(res, null, 'Business deleted successfully');
  } catch (error) {
    next(error);
  }
};
