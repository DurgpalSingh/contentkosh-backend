import { Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { practiceTestService as service } from '../services/practice-test.service';
import { TestMapper } from '../mappers/test.mapper';
import { testAttemptService as attemptService } from '../services/test-attempt.service';
import { getBusinessId } from '../utils/request.utils';

export const practiceTestController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const created = await service.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(created), 'Practice test created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create practice test');
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
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

      const list = await service.list(businessId, q, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, list.map(TestMapper.practiceTest), 'Practice tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing practice tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice tests');
    }
  },

  async get(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const t = await service.get(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(t), 'Practice test fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice test');
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const updated = await service.update(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updated), 'Practice test updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update practice test');
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      await service.remove(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, null, 'Practice test deleted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete practice test');
    }
  },

  async publish(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const practiceTestId: string | undefined = req.body.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const updated = await service.publish(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updated), 'Practice test published successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error publishing practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to publish practice test');
    }
  },

  async listQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const qs = await service.listQuestions(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, qs.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing practice questions: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch questions');
    }
  },

  async createQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const created = await service.createQuestion(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(created), 'Question created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create question');
    }
  },

  async updateQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const updated = await service.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updated), 'Question updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update question');
    }
  },

  async deleteQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      await service.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, { id: questionId }, 'Question deleted successfully', 200);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete question');
    }
  },

  async startAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const practiceTestId: string | undefined = req.body.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const started = await attemptService.startPracticeAttempt(businessId, { id: user.id, role: user.role }, practiceTestId);
      return ApiResponseHandler.success(
        res,
        {
          attemptId: started.attemptId,
          startedAt: started.startedAt,
          test: TestMapper.practiceAvailableTest({ ...started.test, totalQuestions: started.questions.length }),
          questions: started.questions.map(TestMapper.question),
        },
        'Practice attempt started successfully',
        201,
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error starting practice attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to start practice attempt');
    }
  },

  async available(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const list = await attemptService.listAvailablePracticeTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, list, 'Available practice tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching available practice tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch available practice tests');
    }
  },

  async getAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const details = await attemptService.getPracticeAttemptDetails(businessId, { id: user.id, role: user.role }, attemptId);
      return ApiResponseHandler.success(
        res,
        {
          attempt: details.attempt,
          test: TestMapper.practiceAvailableTest({ ...details.test, totalQuestions: details.questions.length }),
          questions: details.questions.map(TestMapper.question),
          answers: details.answers,
        },
        'Practice attempt fetched successfully',
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching practice attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice attempt');
    }
  },

  async submitAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const result = await attemptService.submitPracticeAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, result, 'Practice attempt submitted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error submitting practice attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to submit practice attempt');
    }
  },

  async analytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const analytics = await attemptService.getPracticeTestAnalytics(businessId, { id: user.id, role: user.role }, practiceTestId);
      return ApiResponseHandler.success(res, analytics, 'Practice test analytics fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching practice test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice test analytics');
    }
  },

  async exportAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const csv = await attemptService.exportPracticeTestAnalyticsCSV(businessId, { id: user.id, role: user.role }, practiceTestId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="practice-test-${practiceTestId}-analytics.csv"`);
      return res.status(200).send(csv);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error exporting practice test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to export practice test analytics');
    }
  },
};

