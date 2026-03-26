import { Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { examTestService } from '../services/examTest.service';
import { TestMapper } from '../mappers/test.mapper';
import { PublishExamTestRequestDto } from '../dtos/test.dto';
import { testAttemptService } from '../services/testAttempt.service';
import { getBusinessId } from '../utils/request.utils';
import { handleTestControllerError, parseOptionalIntQueryParam } from '../utils/testController.utils';


export const examTestController = {
  async createExamTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const createdExamTest = await examTestService.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.created(res, TestMapper.examTest(createdExamTest), 'Exam test created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'createExamTest', serverErrorMessage: 'Failed to create exam test' });
    }
  },

  async listExamTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      
      const statusFilter = parseOptionalIntQueryParam(req.query.status, 'status');
      const batchIdFilter = parseOptionalIntQueryParam(req.query.batchId, 'batchId');

      const filters: { status?: number; batchId?: number } = {
        ...(statusFilter !== undefined ? { status: statusFilter } : {}),
        ...(batchIdFilter !== undefined ? { batchId: batchIdFilter } : {}),
      };

      const examTests = await examTestService.list(businessId, filters, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, examTests.map(TestMapper.examTest), 'Exam tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listExamTests', serverErrorMessage: 'Failed to fetch exam tests' });
    }
  },

  async getExamTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      
      const examTestId = req.params.examTestId!;
      const examTestRecord = await examTestService.get(businessId, examTestId, { id: user.id, role: user.role });
      const { questions, ...testData } = examTestRecord;
      const responsePayload = {
        ...TestMapper.examTest(testData),
        ...(questions ? { questions: questions.map(TestMapper.question) } : {}),
      };
      return ApiResponseHandler.success(res, responsePayload, 'Exam test fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getExamTest', serverErrorMessage: 'Failed to fetch exam test' });
    }
  },

  async updateExamTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId!;
      
      const user = req.user!;

      const updatedExamTest = await examTestService.update(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(updatedExamTest), 'Exam test updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'updateExamTest', serverErrorMessage: 'Failed to update exam test' });
    }
  },

  async deleteExamTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId!;
      
      const user = req.user!;
      await examTestService.remove(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, null, 'Exam test deleted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'deleteExamTest', serverErrorMessage: 'Failed to delete exam test' });
    }
  },

  async publishExamTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId: string | undefined = (req.body as PublishExamTestRequestDto).examTestId;
      const publishedExamTest = await examTestService.publish(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(publishedExamTest), 'Exam test published successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'publishExamTest', serverErrorMessage: 'Failed to publish exam test' });
    }
  },

  async listExamTestQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId!;
      
      const user = req.user!;
      const questions = await examTestService.listQuestions(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, questions.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listExamTestQuestions', serverErrorMessage: 'Failed to fetch questions' });
    }
  },

  async createExamTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId!;
      
      const user = req.user!;
      const createdQuestion = await examTestService.createQuestion(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.created(res, TestMapper.question(createdQuestion), 'Question created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'createExamTestQuestion', serverErrorMessage: 'Failed to create question' });
    }
  },

  async updateExamTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId!;
      
      const user = req.user!;
      const updatedQuestion = await examTestService.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updatedQuestion), 'Question updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'updateExamTestQuestion', serverErrorMessage: 'Failed to update question' });
    }
  },

  async deleteExamTestQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId!;
      
      const user = req.user!;
      await examTestService.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, { id: questionId }, 'Question deleted successfully', 200);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'deleteExamTestQuestion', serverErrorMessage: 'Failed to delete question' });
    }
  },

  async startExamTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
  
      const user = req.user!;

      const examTestId = req.body.examTestId!;

      const attemptStart = await testAttemptService.startExamAttempt(businessId, { id: user.id, role: user.role }, examTestId);
      return ApiResponseHandler.created(
        res,
        {
          attemptId: attemptStart.attemptId,
          startedAt: attemptStart.startedAt,
          test: TestMapper.examAvailableTest({ ...attemptStart.test, totalQuestions: attemptStart.questions.length }),
          questions: attemptStart.questions.map(TestMapper.questionForAttempt),
        },
        'Exam attempt started successfully',
      );
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'startExamTestAttempt', serverErrorMessage: 'Failed to start exam attempt' });
    }
  },

  async listAvailableExamTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const availableExamTests = await testAttemptService.listAvailableExamTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, availableExamTests, 'Available exam tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'listAvailableExamTests',
        serverErrorMessage: 'Failed to fetch available exam tests',
      });
    }
  },

  async getExamTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;
      const attemptId = req.params.attemptId!;

      const attemptDetails = await testAttemptService.getExamAttemptDetails(businessId, { id: user.id, role: user.role }, attemptId);
      return ApiResponseHandler.success(
        res,
        {
          attempt: attemptDetails.attempt,
          test: TestMapper.examAvailableTest({ ...attemptDetails.test, totalQuestions: attemptDetails.questions.length }),
          questions: attemptDetails.questions,
        },
        'Exam attempt fetched successfully',
      );
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getExamTestAttempt', serverErrorMessage: 'Failed to fetch exam attempt' });
    }
  },

  async submitExamTestAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;
      const attemptId = req.params.attemptId!;

      const submissionResult = await testAttemptService.submitExamAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, submissionResult, 'Exam attempt submitted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'submitExamTestAttempt',
        serverErrorMessage: 'Failed to submit exam attempt',
      });
    }
  },

  async getExamTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId = req.params.examTestId!;

      const analyticsData = await testAttemptService.getExamTestAnalytics(businessId, { id: user.id, role: user.role }, examTestId);
      return ApiResponseHandler.success(res, analyticsData, 'Exam test analytics fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'getExamTestAnalytics',
        serverErrorMessage: 'Failed to fetch exam test analytics',
      });
    }
  },

  async exportExamTestAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId = req.params.examTestId!;

      const analyticsCsv = await testAttemptService.exportExamTestAnalyticsCSV(businessId, { id: user.id, role: user.role }, examTestId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="exam-test-${examTestId}-analytics.csv"`);
      return res.status(200).send(analyticsCsv);
    } catch (e: unknown) {
      return handleTestControllerError({
        res,
        error: e,
        endpoint: 'exportExamTestAnalytics',
        serverErrorMessage: 'Failed to export exam test analytics',
      });
    }
  },
};

