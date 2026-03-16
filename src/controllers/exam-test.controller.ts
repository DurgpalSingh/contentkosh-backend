import { Request, Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { ExamTestService } from '../services/exam-test.service';
import { TestMapper } from '../mappers/test.mapper';
import { UserRole } from '@prisma/client';

const service = new ExamTestService();

function getBusinessId(req: Request): number {
  const businessId = Number(req.params.businessId);
  if (!businessId || !Number.isInteger(businessId)) {
    throw new BadRequestError('Invalid businessId');
  }
  return businessId;
}

function enforceBusinessScope(req: AuthRequest, res: Response, businessId: number): boolean {
  const user = req.user;
  if (!user) {
    ApiResponseHandler.unauthorized(res, 'User not authenticated');
    return false;
  }
  const isSuperAdmin = user.role === UserRole.SUPERADMIN;
  const hasBusinessAccess = user.businessId === businessId;
  if (!isSuperAdmin && !hasBusinessAccess) {
    ApiResponseHandler.forbidden(res, 'Forbidden: You do not have access to this business');
    return false;
  }
  return true;
}

export const examTestController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const created = await service.create(businessId, req.body, userId);
      return ApiResponseHandler.success(res, TestMapper.examTest(created), 'Exam test created successfully', 201);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      logger.error(`Error creating exam test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create exam test');
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const status = req.query.status !== undefined ? Number(req.query.status) : undefined;
      const batchId = req.query.batchId !== undefined ? Number(req.query.batchId) : undefined;

      if (status !== undefined && (Number.isNaN(status) || !Number.isInteger(status))) {
        return ApiResponseHandler.badRequest(res, 'Invalid status');
      }
      if (batchId !== undefined && (Number.isNaN(batchId) || !Number.isInteger(batchId))) {
        return ApiResponseHandler.badRequest(res, 'Invalid batchId');
      }

      const q: { status?: number; batchId?: number } = {};
      if (status !== undefined) q.status = status;
      if (batchId !== undefined) q.batchId = batchId;

      const list = await service.list(businessId, q);
      return ApiResponseHandler.success(res, list.map(TestMapper.examTest), 'Exam tests fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      logger.error(`Error listing exam tests: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam tests');
    }
  },

  async get(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const examTestId = req.params.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const t = await service.get(businessId, examTestId);
      return ApiResponseHandler.success(res, TestMapper.examTest(t), 'Exam test fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error fetching exam test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam test');
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const updated = await service.update(businessId, examTestId, req.body, userId);
      return ApiResponseHandler.success(res, TestMapper.examTest(updated), 'Exam test updated successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error updating exam test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update exam test');
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      await service.remove(businessId, examTestId);
      return ApiResponseHandler.success(res, null, 'Exam test deleted successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error deleting exam test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete exam test');
    }
  },

  async publish(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const examTestId: string | undefined = req.body.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const updated = await service.publish(businessId, examTestId, userId);
      return ApiResponseHandler.success(res, TestMapper.examTest(updated), 'Exam test published successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error publishing exam test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to publish exam test');
    }
  },

  async listQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const qs = await service.listQuestions(businessId, examTestId);
      return ApiResponseHandler.success(res, qs.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error listing exam questions: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch questions');
    }
  },

  async createQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const created = await service.createQuestion(businessId, examTestId, req.body);
      return ApiResponseHandler.success(res, TestMapper.question(created), 'Question created successfully', 201);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error creating exam question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create question');
    }
  },

  async updateQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const updated = await service.updateQuestion(businessId, questionId, req.body);
      return ApiResponseHandler.success(res, TestMapper.question(updated), 'Question updated successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error updating exam question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update question');
    }
  },

  async deleteQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!enforceBusinessScope(req, res, businessId)) return;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      await service.deleteQuestion(businessId, questionId);
      return ApiResponseHandler.success(res, null, 'Question deleted successfully', 204);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error deleting exam question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete question');
    }
  },
};

