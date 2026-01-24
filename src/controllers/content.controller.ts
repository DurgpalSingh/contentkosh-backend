import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/api.errors';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateContentDto, UpdateContentDto, ContentQueryDto } from '../dtos/content.dto';
import { ContentService } from '../services/content.service';
import { AuthRequest } from '../dtos/auth.dto';
import * as fs from 'fs';

export class ContentController {
  private contentService: ContentService;

  constructor(contentService: ContentService) {
    this.contentService = contentService;
  }

  public createContent = async (req: AuthRequest, res: Response) => {
    try {
      // Get batchId from URL params and add to body for DTO validation
      const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');

      const contentData = plainToInstance(CreateContentDto, req.body);
      const user = req.user!;

      const content = await this.contentService.createContent(
        batchId,
        contentData,
        user
      );

      ApiResponseHandler.success(res, content, 'Content created successfully', 201);
    } catch (error: any) {
      if (error instanceof BadRequestError || error instanceof NotFoundError || error instanceof ForbiddenError) {
        const statusCode = error instanceof NotFoundError ? 404 :
          error instanceof ForbiddenError ? 403 : 400;
        return ApiResponseHandler.error(res, error.message, statusCode);
      }
      logger.error(`Error creating content: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to create content');
    }
  };

  public getContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const user = req.user!;

      const content = await this.contentService.getContent(id, user);
      ApiResponseHandler.success(res, content, 'Content fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching content: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch content');
    }
  };

  public getContentsByBatch = async (req: AuthRequest, res: Response) => {
    try {
      const batchId = ValidationUtils.validateId(req.params.batchId, 'Batch ID');
      const user = req.user!;
      const query = plainToInstance(ContentQueryDto, req.query);

      const result = await this.contentService.getContentsByBatch(
        batchId,
        query,
        user
      );

      ApiResponseHandler.success(res, result, 'Contents fetched successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error fetching contents: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to fetch contents');
    }
  };

  public updateContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const contentData = plainToInstance(UpdateContentDto, req.body);
      const user = req.user!;

      const content = await this.contentService.updateContent(id, contentData, user);
      ApiResponseHandler.success(res, content, 'Content updated successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      if (error instanceof BadRequestError) {
        return ApiResponseHandler.error(res, error.message, 400);
      }
      logger.error(`Error updating content: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to update content');
    }
  };

  public deleteContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const user = req.user!;

      await this.contentService.deleteContent(id, user);
      ApiResponseHandler.success(res, null, 'Content deleted successfully');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error deleting content: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to delete content');
    }
  };

  public getContentFile = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const user = req.user!;

      const fileInfo = await this.contentService.getContentFile(id, user);

      // Set appropriate headers
      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);

      // Stream the file
      const fileStream = fs.createReadStream(fileInfo.filePath);
      fileStream.pipe(res);

      // Properly close the stream when response ends
      res.on('finish', () => {
        fileStream.destroy();
      });

      res.on('close', () => {
        if (!fileStream.destroyed) {
          fileStream.destroy();
        }
      });

      fileStream.on('error', (error) => {
        logger.error(`Error streaming file: ${error.message}`);
        if (!res.headersSent) {
          ApiResponseHandler.error(res, 'Failed to stream file');
        }
        fileStream.destroy();
      });

    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return ApiResponseHandler.notFound(res, error.message);
      }
      if (error instanceof ForbiddenError) {
        return ApiResponseHandler.error(res, error.message, 403);
      }
      logger.error(`Error getting content file: ${error.message}`);
      ApiResponseHandler.error(res, 'Failed to get content file');
    }
  };
}

export const contentController = new ContentController(new ContentService());