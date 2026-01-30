import { Response } from 'express';
import { contentController } from '../../../src/controllers/content.controller';
import { ContentService } from '../../../src/services/content.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../../../src/errors/api.errors';
import { ValidationUtils } from '../../../src/utils/validation';
import { ContentType, ContentStatus } from '@prisma/client';
import * as fs from 'fs';
import { AuthRequest } from '../../../src/dtos/auth.dto';

jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');
jest.mock('fs');

describe('Content Controller (Comprehensive)', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 1,
        role: 'TEACHER',
        email: 'teacher@test.com'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      on: jest.fn(),
      headersSent: false
    };

    jest
      .spyOn(ValidationUtils, 'validateId')
      .mockImplementation((v: any) => Number(v));

    jest.clearAllMocks();
  });

  describe('createContent', () => {
    it('creates PDF content successfully', async () => {
      req.params = { batchId: '1' };
      req.body = { title: 'PDF Doc', type: ContentType.PDF };

      const result = { id: 1, title: 'PDF Doc', type: ContentType.PDF };
      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockResolvedValue(result as any);

      await contentController.createContent(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        result,
        'Content created successfully',
        201
      );
    });

    it('creates IMAGE content successfully', async () => {
      req.params = { batchId: '1' };
      req.body = { title: 'Image', type: ContentType.IMAGE };

      const result = { id: 2, title: 'Image', type: ContentType.IMAGE };
      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockResolvedValue(result as any);

      await contentController.createContent(req as any, res as any);
      expect(ApiResponseHandler.success).toHaveBeenCalled();
    });

    it('returns 400 when title is missing', async () => {
      req.params = { batchId: '1' };
      req.body = {};

      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockRejectedValue(new BadRequestError('Title is required'));

      await contentController.createContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Title is required',
        400
      );
    });

    it('returns 404 when batch does not exist', async () => {
      req.params = { batchId: '99' };

      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockRejectedValue(new NotFoundError('Batch'));

      await contentController.createContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Batch not found',
        404
      );
    });

    it('returns 403 when user has no permission', async () => {
      req.params = { batchId: '2' };

      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockRejectedValue(
          new ForbiddenError('No permission to create content')
        );

      await contentController.createContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'No permission to create content',
        403
      );
    });

    it('handles unexpected errors', async () => {
      req.params = { batchId: '1' };

      jest
        .spyOn(ContentService.prototype, 'createContent')
        .mockRejectedValue(new Error());

      await contentController.createContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Failed to create content'
      );
    });
  });


  describe('getContent', () => {
    it('fetches content successfully', async () => {
      req.params = { contentId: '1' };

      const content = { id: 1, title: 'Doc' };
      jest
        .spyOn(ContentService.prototype, 'getContent')
        .mockResolvedValue(content as any);

      await contentController.getContent(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        content,
        'Content fetched successfully'
      );
    });

    it('returns 404 when content not found', async () => {
      req.params = { contentId: '99' };

      jest
        .spyOn(ContentService.prototype, 'getContent')
        .mockRejectedValue(new NotFoundError('Content'));

      await contentController.getContent(req as any, res as any);

      expect(ApiResponseHandler.notFound).toHaveBeenCalledWith(
        res,
        'Content not found'
      );
    });

    it('returns 403 when access denied', async () => {
      req.params = { contentId: '1' };

      jest
        .spyOn(ContentService.prototype, 'getContent')
        .mockRejectedValue(new ForbiddenError('Access denied'));

      await contentController.getContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Access denied',
        403
      );
    });

    it('handles invalid contentId', async () => {
      req.params = { contentId: 'abc' };
      jest
        .spyOn(ValidationUtils, 'validateId')
        .mockImplementationOnce(() => {
          throw new BadRequestError('Invalid ID');
        });

      await contentController.getContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalled();
    });
  });

  describe('getContentsByBatch', () => {
    it('returns contents with filters', async () => {
      req.params = { batchId: '1' };
      req.query = { type: ContentType.PDF, status: ContentStatus.ACTIVE };

      const result = { data: [], total: 0, page: 1, limit: 10 };
      jest
        .spyOn(ContentService.prototype, 'getContentsByBatch')
        .mockResolvedValue(result as any);

      await contentController.getContentsByBatch(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalled();
    });

    it('returns empty list when no content', async () => {
      req.params = { batchId: '1' };

      const result = { data: [], total: 0, page: 1, limit: 10 };
      jest
        .spyOn(ContentService.prototype, 'getContentsByBatch')
        .mockResolvedValue(result as any);

      await contentController.getContentsByBatch(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalled();
    });

    it('returns 403 when batch access denied', async () => {
      req.params = { batchId: '2' };

      jest
        .spyOn(ContentService.prototype, 'getContentsByBatch')
        .mockRejectedValue(new ForbiddenError('Forbidden'));

      await contentController.getContentsByBatch(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Forbidden',
        403
      );
    });
  });

  /* ================= UPDATE ================= */

  describe('updateContent', () => {
    it('updates title successfully', async () => {
      req.params = { contentId: '1' };
      req.body = { title: 'Updated' };

      const updated = { id: 1, title: 'Updated' };
      jest
        .spyOn(ContentService.prototype, 'updateContent')
        .mockResolvedValue(updated as any);

      await contentController.updateContent(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalled();
    });

    it('updates status to INACTIVE', async () => {
      req.params = { contentId: '1' };
      req.body = { status: ContentStatus.INACTIVE };

      jest
        .spyOn(ContentService.prototype, 'updateContent')
        .mockResolvedValue({} as any);

      await contentController.updateContent(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalled();
    });

    it('returns 400 for invalid status', async () => {
      req.params = { contentId: '1' };
      req.body = { status: 'INVALID' };

      jest
        .spyOn(ContentService.prototype, 'updateContent')
        .mockRejectedValue(new BadRequestError('Invalid status'));

      await contentController.updateContent(req as any, res as any);

      expect(ApiResponseHandler.error).toHaveBeenCalledWith(
        res,
        'Invalid status',
        400
      );
    });
  });


  describe('deleteContent', () => {
    it('deletes content successfully', async () => {
      req.params = { contentId: '1' };

      jest
        .spyOn(ContentService.prototype, 'deleteContent')
        .mockResolvedValue(undefined);

      await contentController.deleteContent(req as any, res as any);

      expect(ApiResponseHandler.success).toHaveBeenCalledWith(
        res,
        null,
        'Content deleted successfully'
      );
    });
  });


  describe('getContentFile', () => {
    it('streams file correctly', async () => {
      req.params = { contentId: '1' };

      jest
        .spyOn(ContentService.prototype, 'getContentFile')
        .mockResolvedValue({
          filePath: '/tmp/file.pdf',
          fileName: 'file.pdf',
          mimeType: 'application/pdf'
        });

      const stream = { pipe: jest.fn(), on: jest.fn() };
      (fs.createReadStream as jest.Mock).mockReturnValue(stream);

      await contentController.getContentFile(req as any, res as any);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf'
      );
      expect(stream.pipe).toHaveBeenCalledWith(res);
    });

    it('handles stream error safely', async () => {
      req.params = { contentId: '1' };

      jest
        .spyOn(ContentService.prototype, 'getContentFile')
        .mockResolvedValue({
          filePath: '/tmp/file.pdf',
          fileName: 'file.pdf',
          mimeType: 'application/pdf'
        });

      const stream = {
        pipe: jest.fn(),
        on: jest.fn((_, cb) => cb(new Error())),
        destroy: jest.fn()
      };
      (fs.createReadStream as jest.Mock).mockReturnValue(stream);

      await contentController.getContentFile(req as any, res as any);

      expect(stream.destroy).toHaveBeenCalled();
    });
  });
});