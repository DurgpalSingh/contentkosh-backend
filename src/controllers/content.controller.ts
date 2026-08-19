import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { ValidationUtils } from '../utils/validation';
import { plainToInstance } from 'class-transformer';
import { CreateContentDto, UpdateContentDto, ContentQueryDto } from '../dtos/content.dto';
import { ContentService } from '../services/content.service';
import { AuthRequest } from '../dtos/auth.dto';
import { handleControllerError } from '../utils/controllerErrorHandler';
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to create content', 'Error creating content');
    }
  };

  public getContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const user = req.user!;

      const content = await this.contentService.getContent(id, user);
      ApiResponseHandler.success(res, content, 'Content fetched successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch content', 'Error fetching content');
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
    } catch (error) {
      handleControllerError(res, error, 'Failed to fetch contents', 'Error fetching contents');
    }
  };

  public updateContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const contentData = plainToInstance(UpdateContentDto, req.body);
      const user = req.user!;

      const content = await this.contentService.updateContent(id, contentData, user);
      ApiResponseHandler.success(res, content, 'Content updated successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to update content', 'Error updating content');
    }
  };

  public deleteContent = async (req: AuthRequest, res: Response) => {
    try {
      const id = ValidationUtils.validateId(req.params.contentId, 'Content ID');
      const user = req.user!;

      await this.contentService.deleteContent(id, user);
      ApiResponseHandler.success(res, null, 'Content deleted successfully');
    } catch (error) {
      handleControllerError(res, error, 'Failed to delete content', 'Error deleting content');
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

    } catch (error) {
      handleControllerError(res, error, 'Failed to get content file', 'Error getting content file');
    }
  };
}

export const contentController = new ContentController(new ContentService());
