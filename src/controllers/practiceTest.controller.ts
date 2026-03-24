import { Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { practiceTestService } from '../services/practiceTest.service';
import { TestMapper } from '../mappers/test.mapper';
import { testAttemptService } from '../services/testAttempt.service';
import { getBusinessId } from '../utils/request.utils';

export const practiceTestController = {
  async createPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const createdPracticeTest = await practiceTestService.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(createdPracticeTest), 'Practice test created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create practice test');
    }
  },

  async listPracticeTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const statusFilter = req.query.status !== undefined ? Number(req.query.status) : undefined;
      const batchIdFilter = req.query.batchId !== undefined ? Number(req.query.batchId) : undefined;

      if (statusFilter !== undefined && (Number.isNaN(statusFilter) || !Number.isInteger(statusFilter))) {
        return ApiResponseHandler.badRequest(res, 'Invalid status');
      }
      if (batchIdFilter !== undefined && (Number.isNaN(batchIdFilter) || !Number.isInteger(batchIdFilter))) {
        return ApiResponseHandler.badRequest(res, 'Invalid batchId');
      }

      const filters: { status?: number; batchId?: number } = {};
      if (statusFilter !== undefined) filters.status = statusFilter;
      if (batchIdFilter !== undefined) filters.batchId = batchIdFilter;

      const practiceTests = await practiceTestService.list(businessId, filters, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, practiceTests.map(TestMapper.practiceTest), 'Practice tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing practice tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice tests');
    }
  },

  async getPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const practiceTestRecord = await practiceTestService.get(businessId, practiceTestId, { id: user.id, role: user.role });
      const { questions, ...testData } = practiceTestRecord;
      const responsePayload = {
        ...TestMapper.practiceTest(testData),
        ...(questions ? { questions: questions.map(TestMapper.question) } : {}),
      };
      return ApiResponseHandler.success(res, responsePayload, 'Practice test fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice test');
    }
  },

  async updatePracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user!;

      const updatedPracticeTest = await practiceTestService.update(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updatedPracticeTest), 'Practice test updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update practice test');
    }
  },

  async deletePracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user!;
      await practiceTestService.remove(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, null, 'Practice test deleted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete practice test');
    }
  },

  async publishPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId: string | undefined = req.body.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const publishedPracticeTest = await practiceTestService.publish(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(publishedPracticeTest), 'Practice test published successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error publishing practice test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to publish practice test');
    }
  },

  async listPracticeTestQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user!;
      const questions = await practiceTestService.listQuestions(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, questions.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing practice questions: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch questions');
    }
  },

  async createPracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');
      const user = req.user!;
      const createdQuestion = await practiceTestService.createQuestion(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(createdQuestion), 'Question created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create question');
    }
  },

  async updatePracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user!;
      const updatedQuestion = await practiceTestService.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updatedQuestion), 'Question updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update question');
    }
  },

  async deletePracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user!;
      await practiceTestService.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, { id: questionId }, 'Question deleted successfully', 200);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting practice question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete question');
    }
  },

  async startPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId: string | undefined = req.body.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const attemptStart = await testAttemptService.startPracticeAttempt(businessId, { id: user.id, role: user.role }, practiceTestId);
      return ApiResponseHandler.success(
        res,
        {
          attemptId: attemptStart.attemptId,
          startedAt: attemptStart.startedAt,
          test: TestMapper.practiceAvailableTest({ ...attemptStart.test, totalQuestions: attemptStart.questions.length }),
          questions: attemptStart.questions.map(TestMapper.questionForAttempt),
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

  async listAvailablePracticeTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const availablePracticeTests = await testAttemptService.listAvailablePracticeTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, availablePracticeTests, 'Available practice tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching available practice tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch available practice tests');
    }
  },

  async getPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const attemptDetails = await testAttemptService.getPracticeAttemptDetails(businessId, { id: user.id, role: user.role }, attemptId);
      return ApiResponseHandler.success(
        res,
        {
          attempt: attemptDetails.attempt,
          test: TestMapper.practiceAvailableTest({ ...attemptDetails.test, totalQuestions: attemptDetails.questions.length }),
          questions: attemptDetails.questions,
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

  async submitPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const submissionResult = await testAttemptService.submitPracticeAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, submissionResult, 'Practice attempt submitted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error submitting practice attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to submit practice attempt');
    }
  },

  async getPracticeTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const analyticsData = await testAttemptService.getPracticeTestAnalytics(businessId, { id: user.id, role: user.role }, practiceTestId);
      return ApiResponseHandler.success(res, analyticsData, 'Practice test analytics fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching practice test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch practice test analytics');
    }
  },

  async exportPracticeTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.params.practiceTestId;
      if (!practiceTestId) return ApiResponseHandler.badRequest(res, 'practiceTestId is required');

      const analyticsCsv = await testAttemptService.exportPracticeTestAnalyticsCSV(businessId, { id: user.id, role: user.role }, practiceTestId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="practice-test-${practiceTestId}-analytics.csv"`);
      return res.status(200).send(analyticsCsv);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error exporting practice test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to export practice test analytics');
    }
  },
};

