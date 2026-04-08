import { Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { practiceTestService } from '../services/practiceTest.service';
import { TestMapper } from '../mappers/test.mapper';
import { testAttemptService } from '../services/testAttempt.service';
import { handleTestControllerError, parseOptionalIntQueryParam, getBusinessId } from '../utils/testController.utils';

export const practiceTestController = {
  async createPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const createdPracticeTest = await practiceTestService.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.created(res, TestMapper.practiceTest(createdPracticeTest), 'Practice test created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'createPracticeTest',
        serverErrorMessage: 'Failed to create practice test',
      });
    }
  },

  async listPracticeTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const statusFilter = parseOptionalIntQueryParam(req.query.status, 'status');
      const batchIdFilter = parseOptionalIntQueryParam(req.query.batchId, 'batchId');

      const filters: { status?: number; batchId?: number } = {
        ...(statusFilter !== undefined ? { status: statusFilter } : {}),
        ...(batchIdFilter !== undefined ? { batchId: batchIdFilter } : {}),
      };

      const practiceTests = await practiceTestService.list(businessId, filters, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, practiceTests.map(TestMapper.practiceTest), 'Practice tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'listPracticeTests',
        serverErrorMessage: 'Failed to fetch practice tests',
      });
    }
  },

  async getPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const practiceTestId = req.params.practiceTestId!;
      const practiceTestRecord = await practiceTestService.get(businessId, practiceTestId, { id: user.id, role: user.role });
      const { questions, ...testData } = practiceTestRecord;
      const responsePayload = {
        ...TestMapper.practiceTest(testData),
        ...(questions ? { questions: questions.map(TestMapper.question) } : {}),
      };
      return ApiResponseHandler.success(res, responsePayload, 'Practice test fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'getPracticeTest',
        serverErrorMessage: 'Failed to fetch practice test',
      });
    }
  },

  async updatePracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId!;
      const user = req.user!;

      const updatedPracticeTest = await practiceTestService.update(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(updatedPracticeTest), 'Practice test updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'updatePracticeTest',
        serverErrorMessage: 'Failed to update practice test',
      });
    }
  },

  async deletePracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId!;
      const user = req.user!;
      await practiceTestService.remove(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, null, 'Practice test deleted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'deletePracticeTest',
        serverErrorMessage: 'Failed to delete practice test',
      });
    }
  },

  async publishPracticeTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.body.practiceTestId!;
      const publishedPracticeTest = await practiceTestService.publish(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.practiceTest(publishedPracticeTest), 'Practice test published successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'publishPracticeTest',
        serverErrorMessage: 'Failed to publish practice test',
      });
    }
  },

  async listPracticeTestQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId!;
      const user = req.user!;
      const questions = await practiceTestService.listQuestions(businessId, practiceTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, questions.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'listPracticeTestQuestions',
        serverErrorMessage: 'Failed to fetch questions',
      });
    }
  },

  async createPracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const practiceTestId = req.params.practiceTestId!;
      const user = req.user!;
      const createdQuestion = await practiceTestService.createQuestion(businessId, practiceTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.created(res, TestMapper.question(createdQuestion), 'Question created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'createPracticeTestQuestion',
        serverErrorMessage: 'Failed to create question',
      });
    }
  },

  async updatePracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId!;
      const user = req.user!;
      const updatedQuestion = await practiceTestService.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updatedQuestion), 'Question updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'updatePracticeTestQuestion',
        serverErrorMessage: 'Failed to update question',
      });
    }
  },

  async deletePracticeTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId!;
      const user = req.user!;
      await practiceTestService.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, { id: questionId }, 'Question deleted successfully', 200);
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'deletePracticeTestQuestion',
        serverErrorMessage: 'Failed to delete question',
      });
    }
  },

  async startPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.body.practiceTestId!;
      const language = req.body.language!;

      const attemptStart = await testAttemptService.startPracticeAttempt(
        businessId,
        { id: user.id, role: user.role },
        practiceTestId,
        language,
      );
      return ApiResponseHandler.created(
        res,
        {
          attemptId: attemptStart.attemptId,
          startedAt: attemptStart.startedAt,
          test: TestMapper.practiceAvailableTest({ ...attemptStart.test, totalQuestions: attemptStart.questions.length }),
          questions: attemptStart.questions.map(TestMapper.questionForAttempt),
        },
        'Practice attempt started successfully',
      );
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'startPracticeTestAttempt',
        serverErrorMessage: 'Failed to start practice attempt',
      });
    }
  },

  async listAvailablePracticeTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const availablePracticeTests = await testAttemptService.listAvailablePracticeTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, availablePracticeTests, 'Available practice tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'listAvailablePracticeTests',
        serverErrorMessage: 'Failed to fetch available practice tests',
      });
    }
  },

  async getPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const attemptId = req.params.attemptId!;

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
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'getPracticeTestAttempt',
        serverErrorMessage: 'Failed to fetch practice attempt',
      });
    }
  },

  async submitPracticeTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      const attemptId = req.params.attemptId!;

      const submissionResult = await testAttemptService.submitPracticeAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, submissionResult, 'Practice attempt submitted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'submitPracticeTestAttempt',
        serverErrorMessage: 'Failed to submit practice attempt',
      });
    }
  },

  async getPracticeTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.params.practiceTestId!;

      const analyticsData = await testAttemptService.getPracticeTestAnalytics(businessId, { id: user.id, role: user.role }, practiceTestId);
      return ApiResponseHandler.success(res, analyticsData, 'Practice test analytics fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'getPracticeTestAnalytics',
        serverErrorMessage: 'Failed to fetch practice test analytics',
      });
    }
  },

  async exportPracticeTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;

      const practiceTestId = req.params.practiceTestId!;

      const analyticsCsv = await testAttemptService.exportPracticeTestAnalyticsCSV(businessId, { id: user.id, role: user.role }, practiceTestId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="practice-test-${practiceTestId}-analytics.csv"`);
      return res.status(200).send(analyticsCsv);
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'exportPracticeTestAnalytics',
        serverErrorMessage: 'Failed to export practice test analytics',
      });
    }
  },
};

