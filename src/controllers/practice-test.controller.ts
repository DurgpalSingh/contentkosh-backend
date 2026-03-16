import { Request, Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { PracticeTestService } from '../services/practice-test.service';
import { TestMapper } from '../mappers/test.mapper';
import { UserRole } from '@prisma/client';

const service = new PracticeTestService();

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

export const practiceTestController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const created = await service.create(businessId, req.body, userId);
      return ApiResponseHandler.success(res, TestMapper.practiceTest(created), 'Practice test created successfully', 201);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      logger.error(`Error creating practice test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create practice test');
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
      return ApiResponseHandler.success(res, list.map(TestMapper.practiceTest), 'Practice tests fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      logger.error(`Error listing practice tests: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice tests');
    }
  },

  async get(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const t = await service.get(businessId, practiceTestId);
      return ApiResponseHandler.success(res, TestMapper.practiceTest(t), 'Practice test fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error fetching practice test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice test');
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const updated = await service.update(businessId, practiceTestId, req.body, userId);
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updated), 'Practice test updated successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error updating practice test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update practice test');
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      await service.remove(businessId, practiceTestId);
      return ApiResponseHandler.success(res, null, 'Practice test deleted successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error deleting practice test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete practice test');
    }
  },

  async publish(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const userId = req.user?.id;
      if (!userId) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const practiceTestId: string | undefined = req.body.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const updated = await service.publish(businessId, practiceTestId, userId);
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updated), 'Practice test published successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error publishing practice test: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to publish practice test');
    }
  },

  async listQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const qs = await service.listQuestions(businessId, practiceTestId);
      return ApiResponseHandler.success(res, qs.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error listing practice questions: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch questions');
    }
  },

  async createQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const created = await service.createQuestion(businessId, practiceTestId, req.body);
      return ApiResponseHandler.success(res, TestMapper.question(created), 'Question created successfully', 201);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error creating practice question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create question');
    }
  },

  async updateQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const updated = await service.updateQuestion(businessId, questionId, req.body);
      return ApiResponseHandler.success(res, TestMapper.question(updated), 'Question updated successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error updating practice question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update question');
    }
  },

  async deleteQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      if (!enforceBusinessScope(req, res, businessId)) return;
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      await service.deleteQuestion(businessId, questionId);
      return ApiResponseHandler.success(res, null, 'Question deleted successfully', 204);
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error deleting practice question: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete question');
    }
  },
};

