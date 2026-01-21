import { Request, Response } from 'express';
import { contentController } from '../../../src/controllers/content.controller';
import { ContentService } from '../../../src/services/content.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';
import { ContentType, ContentStatus } from '@prisma/client';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('fs');

describe('Content Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  // Spies
  let createContentSpy: jest.SpyInstance;
  let getContentSpy: jest.SpyInstance;
  let getContentsByBatchSpy: jest.SpyInstance;
  let updateContentSpy: jest.SpyInstance;
  let deleteContentSpy: jest.SpyInstance;
  let getContentFileSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: {
        id: 1,
        email: 'teacher@example.com',
        role: 'TEACHER',
        tenantId: 1,
        batchIds: [1, 2, 3]
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    jest.clearAllMocks();

    // Spy on ContentService prototype methods
    createContentSpy = jest.spyOn(ContentService.prototype, 'createContent');
    getContentSpy = jest.spyOn(ContentService.prototype, 'getContent');
    getContentsByBatchSpy = jest.spyOn(ContentService.prototype, 'getContentsByBatch');
    updateContentSpy = jest.spyOn(ContentService.prototype, 'updateContent');
    deleteContentSpy = jest.spyOn(ContentService.prototype, 'deleteContent');
    getContentFileSpy = jest.spyOn(ContentService.prototype, 'getContentFile');

    // Mock ValidationUtils.validateId to return ID as number
    jest.spyOn(ValidationUtils, 'validateId').mockImplementation((id) => Number(id));

    // Reset fs mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createContent', () => {
    const validContentData = {
      title: 'Introduction to JavaScript',
      type: ContentType.PDF,
      filePath: '/uploads/content/video.pdf',
      fileSize: 50000000,
      status: ContentStatus.ACTIVE
    };

    it('should create content successfully', async () => {
      req.body = validContentData;
      req.params = { batchId: '1' };
      const createdContent = {
        id: 1,
        ...validContentData,
        batchId: 1,
        uploaderId: 1
      };

      createContentSpy.mockResolvedValue(createdContent as any);

      await contentController.createContent(req as Request, res as Response);

      expect(createContentSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: 'Introduction to JavaScript',
          type: ContentType.PDF
        }),
        req.user
      );
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        createdContent,
        'Content created successfully',
        201
      );
    });

    it('should return 400 if title is missing', async () => {
      req.body = {
        type: ContentType.PDF,
        filePath: '/uploads/content/file.pdf',
        fileSize: 5000000
      };
      req.params = { batchId: '1' };

      createContentSpy.mockRejectedValue(new BadRequestError('Title is required'));

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(res, 'Title is required', 400);
    });

    it('should return 400 if file type is invalid', async () => {
      req.body = {
        title: 'Test Content',
        type: 'INVALID_TYPE',
        filePath: '/uploads/content/file.txt',
        fileSize: 1000000
      };
      req.params = { batchId: '1' };

      createContentSpy.mockRejectedValue(new BadRequestError('Invalid content type'));

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Invalid content type',
        400
      );
    });

    it('should return 400 if file size exceeds limit', async () => {
      req.body = {
        title: 'Large File',
        type: ContentType.PDF,
        filePath: '/uploads/content/large.pdf',
        fileSize: 10000000000 // 10GB
      };
      req.params = { batchId: '1' };

      createContentSpy.mockRejectedValue(
        new BadRequestError('File size exceeds maximum allowed limit')
      );

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'File size exceeds maximum allowed limit',
        400
      );
    });

    it('should return 404 if batch not found', async () => {
      req.body = validContentData;
      req.params = { batchId: '999' };

      createContentSpy.mockRejectedValue(new NotFoundError('Batch'));

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Batch not found',
        404
      );
    });

    it('should return 403 if user does not have access to batch', async () => {
      req.body = validContentData;
      req.params = { batchId: '999' };

      createContentSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to add content to this batch')
      );

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to add content to this batch',
        403
      );
    });

    it('should handle service errors gracefully', async () => {
      req.body = validContentData;
      req.params = { batchId: '1' };

      createContentSpy.mockRejectedValue(new Error('Database error'));

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to create content'
      );
    });
  });

  describe('getContent', () => {
    const mockContent = {
      id: 1,
      title: 'Introduction to JavaScript',
      type: ContentType.PDF,
      filePath: '/uploads/content/video.pdf',
      fileSize: 50000000,
      status: ContentStatus.ACTIVE,
      batchId: 1,
      uploaderId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should retrieve content by ID successfully', async () => {
      req.params = { contentId: '1' };

      getContentSpy.mockResolvedValue(mockContent);

      await contentController.getContent(req as Request, res as Response);

      expect(getContentSpy).toHaveBeenCalledWith(1, req.user);
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        mockContent,
        'Content fetched successfully'
      );
    });

    it('should return 404 if content not found', async () => {
      req.params = { contentId: '999' };

      getContentSpy.mockRejectedValue(new NotFoundError('Content'));

      await contentController.getContent(req as Request, res as Response);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Content not found'
      );
    });

    it('should return 403 if user does not have access to content', async () => {
      req.params = { contentId: '1' };

      getContentSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to access this content')
      );

      await contentController.getContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to access this content',
        403
      );
    });

    it('should handle content ID validation error', async () => {
      req.params = { contentId: 'invalid' };

      jest.spyOn(ValidationUtils, 'validateId').mockImplementationOnce(() => {
        throw new BadRequestError('Invalid content ID format');
      });

      try {
        await contentController.getContent(req as Request, res as Response);
      } catch (error) {
        // Expected
      }
    });

    it('should handle service errors gracefully', async () => {
      req.params = { contentId: '1' };

      getContentSpy.mockRejectedValue(new Error('Database error'));

      await contentController.getContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to fetch content'
      );
    });
  });

  describe('getContentsByBatch', () => {
    const mockContents = [
      {
        id: 1,
        title: 'Content 1',
        type: ContentType.PDF,
        status: ContentStatus.ACTIVE
      },
      {
        id: 2,
        title: 'Content 2',
        type: ContentType.PDF,
        status: ContentStatus.ACTIVE
      }
    ];

    it('should retrieve contents by batch ID without filters', async () => {
      req.params = { batchId: '1' };
      req.query = {};

      const mockResult = {
        data: mockContents,
        total: 2,
        page: 1,
        limit: 10
      };

      getContentsByBatchSpy.mockResolvedValue(mockResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(getContentsByBatchSpy).toHaveBeenCalledWith(1, expect.any(Object), req.user);
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        mockResult,
        'Contents fetched successfully'
      );
    });

    it('should retrieve contents filtered by type', async () => {
      req.params = { batchId: '1' };
      req.query = { type: ContentType.PDF };

      const filteredResult = {
        data: [mockContents[0]],
        total: 1,
        page: 1,
        limit: 10
      };

      getContentsByBatchSpy.mockResolvedValue(filteredResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(getContentsByBatchSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ type: ContentType.PDF }),
        req.user
      );
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        filteredResult,
        'Contents fetched successfully'
      );
    });

    it('should retrieve contents filtered by status', async () => {
      req.params = { batchId: '1' };
      req.query = { status: ContentStatus.ARCHIVED };

      const filteredResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10
      };

      getContentsByBatchSpy.mockResolvedValue(filteredResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        filteredResult,
        'Contents fetched successfully'
      );
    });

    it('should retrieve contents with search filter', async () => {
      req.params = { batchId: '1' };
      req.query = { search: 'JavaScript' };

      const searchResult = {
        data: [mockContents[0]],
        total: 1,
        page: 1,
        limit: 10
      };

      getContentsByBatchSpy.mockResolvedValue(searchResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        searchResult,
        'Contents fetched successfully'
      );
    });

    it('should return 404 if batch not found', async () => {
      req.params = { batchId: '999' };
      req.query = {};

      getContentsByBatchSpy.mockRejectedValue(new NotFoundError('Batch'));

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Batch not found'
      );
    });

    it('should return 403 if user does not have access to batch', async () => {
      req.params = { batchId: '999' };
      req.query = {};

      getContentsByBatchSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to view contents of this batch')
      );

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to view contents of this batch',
        403
      );
    });

    it('should handle pagination parameters', async () => {
      req.params = { batchId: '1' };
      req.query = { page: '2', limit: '5' };

      const paginatedResult = {
        data: mockContents,
        total: 2,
        page: 2,
        limit: 5
      };

      getContentsByBatchSpy.mockResolvedValue(paginatedResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        paginatedResult,
        'Contents fetched successfully'
      );
    });

    it('should handle service errors gracefully', async () => {
      req.params = { batchId: '1' };
      req.query = {};

      getContentsByBatchSpy.mockRejectedValue(new Error('Database error'));

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to fetch contents'
      );
    });
  });

  describe('updateContent', () => {
    const updateData = {
      title: 'Updated Title',
      status: ContentStatus.ARCHIVED
    };

    const updatedContent = {
      id: 1,
      title: 'Updated Title',
      status: ContentStatus.ARCHIVED,
      type: ContentType.PDF
    };

    it('should update content successfully', async () => {
      req.params = { contentId: '1' };
      req.body = updateData;

      updateContentSpy.mockResolvedValue(updatedContent);

      await contentController.updateContent(req as Request, res as Response);

      expect(updateContentSpy).toHaveBeenCalledWith(1, expect.objectContaining(updateData), req.user);
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        updatedContent,
        'Content updated successfully'
      );
    });

    it('should update content title only', async () => {
      req.params = { contentId: '1' };
      req.body = { title: 'New Title' };

      const partialUpdate = {
        id: 1,
        title: 'New Title',
        status: ContentStatus.ACTIVE
      };

      updateContentSpy.mockResolvedValue(partialUpdate);

      await contentController.updateContent(req as Request, res as Response);

      expect(updateContentSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'New Title' }),
        req.user
      );
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        partialUpdate,
        'Content updated successfully'
      );
    });

    it('should update content status only', async () => {
      req.params = { contentId: '1' };
      req.body = { status: ContentStatus.ARCHIVED };

      const statusUpdate = {
        id: 1,
        status: ContentStatus.ARCHIVED
      };

      updateContentSpy.mockResolvedValue(statusUpdate);

      await contentController.updateContent(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        statusUpdate,
        'Content updated successfully'
      );
    });

    it('should return 404 if content not found', async () => {
      req.params = { contentId: '999' };
      req.body = updateData;

      updateContentSpy.mockRejectedValue(new NotFoundError('Content'));

      await contentController.updateContent(req as Request, res as Response);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Content not found'
      );
    });

    it('should return 403 if user does not have permission to update', async () => {
      req.params = { contentId: '1' };
      req.body = updateData;

      updateContentSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to update this content')
      );

      await contentController.updateContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to update this content',
        403
      );
    });

    it('should return 400 if invalid status value', async () => {
      req.params = { contentId: '1' };
      req.body = { status: 'INVALID_STATUS' };

      updateContentSpy.mockRejectedValue(new BadRequestError('Invalid status value'));

      await contentController.updateContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Invalid status value',
        400
      );
    });

    it('should handle service errors gracefully', async () => {
      req.params = { contentId: '1' };
      req.body = updateData;

      updateContentSpy.mockRejectedValue(new Error('Database error'));

      await contentController.updateContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to update content'
      );
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      req.params = { contentId: '1' };

      deleteContentSpy.mockResolvedValue(undefined);

      await contentController.deleteContent(req as Request, res as Response);

      expect(deleteContentSpy).toHaveBeenCalledWith(1, req.user);
      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        null,
        'Content deleted successfully'
      );
    });

    it('should return 404 if content not found', async () => {
      req.params = { contentId: '999' };

      deleteContentSpy.mockRejectedValue(new NotFoundError('Content'));

      await contentController.deleteContent(req as Request, res as Response);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Content not found'
      );
    });

    it('should return 403 if user does not have permission to delete', async () => {
      req.params = { contentId: '1' };

      deleteContentSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to delete this content')
      );

      await contentController.deleteContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to delete this content',
        403
      );
    });

    it('should handle service errors gracefully', async () => {
      req.params = { contentId: '1' };

      deleteContentSpy.mockRejectedValue(new Error('Database error'));

      await contentController.deleteContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to delete content'
      );
    });
  });

  describe('getContentFile', () => {
    const fileInfo = {
      filePath: '/uploads/content/video.pdf',
      fileName: 'video.pdf',
      mimeType: 'video/mp4'
    };

    it('should stream content file successfully', async () => {
      req.params = { contentId: '1' };

      const mockFileStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            // Don't call callback to simulate success
          }
          return mockFileStream;
        })
      };

      getContentFileSpy.mockResolvedValue(fileInfo);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);

      await contentController.getContentFile(req as Request, res as Response);

      expect(getContentFileSpy).toHaveBeenCalledWith(1, req.user);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="video.pdf"'
      );
      expect(mockFileStream.pipe).toHaveBeenCalledWith(res);
    });

    it('should stream PDF file successfully', async () => {
      req.params = { contentId: '2' };

      const pdfFileInfo = {
        filePath: '/uploads/content/document.pdf',
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      };

      const mockFileStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn()
      };

      getContentFileSpy.mockResolvedValue(pdfFileInfo);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);

      await contentController.getContentFile(req as Request, res as Response);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="document.pdf"'
      );
    });

    it('should return 404 if content not found', async () => {
      req.params = { contentId: '999' };

      getContentFileSpy.mockRejectedValue(new NotFoundError('Content'));

      await contentController.getContentFile(req as Request, res as Response);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Content not found'
      );
    });

    it('should return 403 if user does not have permission to access file', async () => {
      req.params = { contentId: '1' };

      getContentFileSpy.mockRejectedValue(
        new ForbiddenError('You do not have permission to access this file')
      );

      await contentController.getContentFile(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'You do not have permission to access this file',
        403
      );
    });

    it('should handle file stream errors gracefully', async () => {
      req.params = { contentId: '1' };

      const mockFileStream = {
        pipe: jest.fn(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('File stream error')), 0);
          }
          return mockFileStream;
        })
      };

      getContentFileSpy.mockResolvedValue(fileInfo);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);

      await contentController.getContentFile(req as Request, res as Response);

      // Error event listener should be registered
      expect(mockFileStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle service errors when fetching file info', async () => {
      req.params = { contentId: '1' };

      getContentFileSpy.mockRejectedValue(new Error('Database error'));

      await contentController.getContentFile(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to get content file'
      );
    });

    it('should set correct headers for image files', async () => {
      req.params = { contentId: '3' };

      const imageFileInfo = {
        filePath: '/uploads/content/image.png',
        fileName: 'image.png',
        mimeType: 'image/png'
      };

      const mockFileStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn()
      };

      getContentFileSpy.mockResolvedValue(imageFileInfo);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);

      await contentController.getContentFile(req as Request, res as Response);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="image.png"'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined user in request', async () => {
      req.user = undefined;
      req.params = { contentId: '1' };

      getContentSpy.mockRejectedValue(new Error('User not authenticated'));

      await contentController.getContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalled();
    });

    it('should validate content ID parameter', async () => {
      req.params = { contentId: 'abc' };

      jest.spyOn(ValidationUtils, 'validateId').mockImplementationOnce(() => {
        throw new BadRequestError('Invalid content ID');
      });

      // This should throw since we're not mocking the service call
      try {
        await contentController.getContent(req as Request, res as Response);
      } catch (error) {
        // Expected behavior
      }
    });

    it('should validate batch ID parameter', async () => {
      req.params = { batchId: 'invalid' };
      req.query = {};

      jest.spyOn(ValidationUtils, 'validateId').mockImplementationOnce(() => {
        throw new BadRequestError('Invalid batch ID');
      });

      try {
        await contentController.getContentsByBatch(req as Request, res as Response);
      } catch (error) {
        // Expected behavior
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content list for batch', async () => {
      req.params = { batchId: '1' };
      req.query = {};

      const emptyResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10
      };

      getContentsByBatchSpy.mockResolvedValue(emptyResult);

      await contentController.getContentsByBatch(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        emptyResult,
        'Contents fetched successfully'
      );
    });

    it('should handle very large file size values', async () => {
      req.body = {
        title: 'Large File',
        type: ContentType.PDF,
        filePath: '/uploads/content/large.pdf',
        fileSize: Number.MAX_SAFE_INTEGER
      };
      req.params = { batchId: '1' };

      createContentSpy.mockRejectedValue(
        new BadRequestError('File size exceeds maximum allowed limit')
      );

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'File size exceeds maximum allowed limit',
        400
      );
    });

    it('should handle special characters in content title', async () => {
      req.body = {
        title: 'Content with "quotes" & <html>',
        type: ContentType.PDF,
        filePath: '/uploads/content/video.pdf',
        fileSize: 50000000
      };
      req.params = { batchId: '1' };

      const createdContent = {
        id: 1,
        title: 'Content with "quotes" & <html>',
        type: ContentType.PDF
      };

      createContentSpy.mockResolvedValue(createdContent as any);

      await contentController.createContent(req as Request, res as Response);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        createdContent,
        'Content created successfully',
        201
      );
    });

    it('should handle file names with special characters', async () => {
      req.params = { contentId: '1' };

      const fileInfo = {
        filePath: '/uploads/content/video.pdf',
        fileName: 'my-video_file (1).pdf',
        mimeType: 'video/mp4'
      };

      const mockFileStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn()
      };

      getContentFileSpy.mockResolvedValue(fileInfo);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);

      await contentController.getContentFile(req as Request, res as Response);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="my-video_file (1).pdf"'
      );
    });
  });
});
