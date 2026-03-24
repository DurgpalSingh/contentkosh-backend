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


export const examTestController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const createdExamTest = await examTestService.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(createdExamTest), 'Exam test created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating exam test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create exam test');
    }
  },

  async list(req: AuthRequest, res: Response) {
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

      const examTests = await examTestService.list(businessId, filters, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, examTests.map(TestMapper.examTest), 'Exam tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing exam tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam tests');
    }
  },

  async get(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const user = req.user!;
      
      const examTestId = req.params.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const examTestRecord = await examTestService.get(businessId, examTestId, { id: user.id, role: user.role });
      const { questions, ...testData } = examTestRecord;
      const responsePayload = {
        ...TestMapper.examTest(testData),
        ...(questions ? { questions: questions.map(TestMapper.question) } : {}),
      };
      return ApiResponseHandler.success(res, responsePayload, 'Exam test fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching exam test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam test');
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const user = req.user!;

      const updatedExamTest = await examTestService.update(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(updatedExamTest), 'Exam test updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating exam test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update exam test');
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const user = req.user!;
      await examTestService.remove(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, null, 'Exam test deleted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting exam test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete exam test');
    }
  },

  async publish(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId: string | undefined = (req.body as PublishExamTestRequestDto).examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const publishedExamTest = await examTestService.publish(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(publishedExamTest), 'Exam test published successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error publishing exam test: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to publish exam test');
    }
  },

  async listQuestions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const user = req.user!;
      const questions = await examTestService.listQuestions(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, questions.map(TestMapper.question), 'Questions fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error listing exam questions: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch questions');
    }
  },

  async createQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const examTestId = req.params.examTestId;
      
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const user = req.user!;
      const createdQuestion = await examTestService.createQuestion(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(createdQuestion), 'Question created successfully', 201);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error creating exam question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to create question');
    }
  },

  async updateQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user!;
      const updatedQuestion = await examTestService.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updatedQuestion), 'Question updated successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error updating exam question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to update question');
    }
  },

  async deleteQuestion(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const questionId = req.params.questionId;
      
      if (!questionId) return ApiResponseHandler.badRequest(res, 'questionId is required');
      const user = req.user!;
      await examTestService.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, { id: questionId }, 'Question deleted successfully', 200);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error deleting exam question: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to delete question');
    }
  },

  async startAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
  
      const user = req.user!;

      const examTestId: string | undefined = req.body.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');

      const attemptStart = await testAttemptService.startExamAttempt(businessId, { id: user.id, role: user.role }, examTestId);
      return ApiResponseHandler.success(
        res,
        {
          attemptId: attemptStart.attemptId,
          startedAt: attemptStart.startedAt,
          test: TestMapper.examAvailableTest({ ...attemptStart.test, totalQuestions: attemptStart.questions.length }),
          questions: attemptStart.questions.map(TestMapper.questionForAttempt),
        },
        'Exam attempt started successfully',
        201,
      );
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error starting exam attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to start exam attempt');
    }
  },

  async available(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const availableExamTests = await testAttemptService.listAvailableExamTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, availableExamTests, 'Available exam tests fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching available exam tests: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch available exam tests');
    }
  },

  async getAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

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
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching exam attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam attempt');
    }
  },

  async submitAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const submissionResult = await testAttemptService.submitExamAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, submissionResult, 'Exam attempt submitted successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error submitting exam attempt: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to submit exam attempt');
    }
  },

  async analytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId = req.params.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');

      const analyticsData = await testAttemptService.getExamTestAnalytics(businessId, { id: user.id, role: user.role }, examTestId);
      return ApiResponseHandler.success(res, analyticsData, 'Exam test analytics fetched successfully');
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error fetching exam test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam test analytics');
    }
  },

  async exportAnalytics(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user!;

      const examTestId = req.params.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');

      const analyticsCsv = await testAttemptService.exportExamTestAnalyticsCSV(businessId, { id: user.id, role: user.role }, examTestId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="exam-test-${examTestId}-analytics.csv"`);
      return res.status(200).send(analyticsCsv);
    } catch (e: unknown) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      const message = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error exporting exam test analytics: ${message}`);
      return ApiResponseHandler.serverError(res, 'Failed to export exam test analytics');
    }
  },
};

