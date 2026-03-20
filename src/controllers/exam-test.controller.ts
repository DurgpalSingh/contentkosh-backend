import { Request, Response } from 'express';
import logger from '../utils/logger';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { ExamTestService } from '../services/exam-test.service';
import { TestMapper } from '../mappers/test.mapper';
import { UserRole } from '@prisma/client';
import { TestAttemptService } from '../services/test-attempt.service';

const service = new ExamTestService();
const attemptService = new TestAttemptService();

function getBusinessId(req: Request): number {
  const businessId = Number(req.params.businessId);
  if (!businessId || !Number.isInteger(businessId)) {
    throw new BadRequestError('Invalid businessId');
  }
  return businessId;
}


export const examTestController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const created = await service.create(businessId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(created), 'Exam test created successfully', 201);
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
      return ApiResponseHandler.success(res, list.map(TestMapper.examTest), 'Exam tests fetched successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      
      const examTestId = req.params.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const t = await service.get(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(t), 'Exam test fetched successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const updated = await service.update(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(updated), 'Exam test updated successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      await service.remove(businessId, examTestId, { id: user.id, role: user.role });
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
      
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const examTestId: string | undefined = req.body.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');
      const updated = await service.publish(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.examTest(updated), 'Exam test published successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const qs = await service.listQuestions(businessId, examTestId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, qs.map(TestMapper.question), 'Questions fetched successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const created = await service.createQuestion(businessId, examTestId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(created), 'Question created successfully', 201);
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const updated = await service.updateQuestion(businessId, questionId, req.body, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, TestMapper.question(updated), 'Question updated successfully');
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
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      await service.deleteQuestion(businessId, questionId, { id: user.id, role: user.role });
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
  
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const examTestId: string | undefined = req.body.examTestId;
      if (!examTestId) return ApiResponseHandler.badRequest(res, 'examTestId is required');

      const started = await attemptService.startExamAttempt(businessId, { id: user.id, role: user.role }, examTestId);
      return ApiResponseHandler.success(
        res,
        {
          attemptId: started.attemptId,
          startedAt: started.startedAt,
          test: TestMapper.examAvailableTest({ ...started.test, totalQuestions: started.questions.length }),
          questions: started.questions.map(TestMapper.question),
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
      
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');

      const list = await attemptService.listAvailableExamTests(businessId, { id: user.id, role: user.role });
      return ApiResponseHandler.success(res, list, 'Available exam tests fetched successfully');
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
      
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const details = await attemptService.getExamAttemptDetails(businessId, { id: user.id, role: user.role }, attemptId);
      return ApiResponseHandler.success(
        res,
        {
          attempt: details.attempt,
          test: TestMapper.examAvailableTest({ ...details.test, totalQuestions: details.questions.length }),
          questions: details.questions.map(TestMapper.question),
          answers: details.answers,
        },
        'Exam attempt fetched successfully',
      );
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error fetching exam attempt: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to fetch exam attempt');
    }
  },

  async submitAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      
      const user = req.user;
      if (!user) return ApiResponseHandler.unauthorized(res, 'User not authenticated');
      const attemptId = req.params.attemptId;
      if (!attemptId) return ApiResponseHandler.badRequest(res, 'attemptId is required');

      const result = await attemptService.submitExamAttempt(
        businessId,
        { id: user.id, role: user.role },
        attemptId,
        Array.isArray(req.body.answers) ? req.body.answers : [],
      );
      return ApiResponseHandler.success(res, result, 'Exam attempt submitted successfully');
    } catch (e: any) {
      if (e instanceof BadRequestError) return ApiResponseHandler.badRequest(res, e.message);
      if (e instanceof NotFoundError) return ApiResponseHandler.notFound(res, e.message);
      logger.error(`Error submitting exam attempt: ${e.message}`);
      return ApiResponseHandler.serverError(res, 'Failed to submit exam attempt');
    }
  },
};

