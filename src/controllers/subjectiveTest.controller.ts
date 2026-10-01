import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { BadRequestError } from '../errors/api.errors';
import { isSubjectiveDisplayStatus } from '../constants/test-enums';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
import { PublishSubjectiveTestRequestDto } from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import { PrivateFileRef, SubmissionListQuery, subjectiveTestService } from '../services/subjectiveTest.service';
import { privateFileService } from '../services/privateFile.service';
import { handleTestControllerError, parseOptionalIntQueryParam, getBusinessId } from '../utils/testController.utils';

const actingUser = (req: AuthRequest) => ({ id: req.user!.id, role: req.user!.role });

const parseOptionalStringQueryParam = (value: unknown, paramName: string): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new BadRequestError(`Invalid ${paramName}`);
  return value;
};

const parseSubmissionListQuery = (query: AuthRequest['query']): SubmissionListQuery => {
  const status = parseOptionalStringQueryParam(query.status, 'status');
  if (status !== undefined && !isSubjectiveDisplayStatus(status)) throw new BadRequestError('Invalid status');
  const search = parseOptionalStringQueryParam(query.search, 'search');
  const page = parseOptionalIntQueryParam(query.page, 'page');
  const limit = parseOptionalIntQueryParam(query.limit, 'limit');
  if (page !== undefined && page < 1) throw new BadRequestError('Invalid page');
  if (limit !== undefined && limit < 1) throw new BadRequestError('Invalid limit');
  return {
    ...(status !== undefined ? { status } : {}),
    ...(search !== undefined ? { search } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
};

const streamPdf = (res: Response, ref: PrivateFileRef) =>
  privateFileService.streamFile(res, ref.key, ref.downloadName, SUBJECTIVE_TEST_CONFIG.pdfMimeType);

export const subjectiveTestController = {
  // ---------------------------------------------------------------------------
  // Staff: manage tests
  // ---------------------------------------------------------------------------

  async createSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const created = await subjectiveTestService.create(businessId, req.body, req.file, actingUser(req));
      return ApiResponseHandler.created(res, SubjectiveTestMapper.test(created), 'Subjective test created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'createSubjectiveTest', serverErrorMessage: 'Failed to create subjective test' });
    }
  },

  async listSubjectiveTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const status = parseOptionalIntQueryParam(req.query.status, 'status');
      const batchId = parseOptionalIntQueryParam(req.query.batchId, 'batchId');
      const paperType = parseOptionalStringQueryParam(req.query.paperType, 'paperType');
      const tests = await subjectiveTestService.list(
        businessId,
        {
          ...(status !== undefined ? { status } : {}),
          ...(batchId !== undefined ? { batchId } : {}),
          ...(paperType !== undefined ? { paperType } : {}),
        },
        actingUser(req),
      );
      return ApiResponseHandler.success(res, tests.map(SubjectiveTestMapper.test), 'Subjective tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listSubjectiveTests', serverErrorMessage: 'Failed to fetch subjective tests' });
    }
  },

  async getSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const { test, submissionCounts } = await subjectiveTestService.get(businessId, req.params.subjectiveTestId!, actingUser(req));
      return ApiResponseHandler.success(res, { ...SubjectiveTestMapper.test(test), submissionCounts }, 'Subjective test fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getSubjectiveTest', serverErrorMessage: 'Failed to fetch subjective test' });
    }
  },

  async updateSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const updated = await subjectiveTestService.update(businessId, req.params.subjectiveTestId!, req.body, req.file, actingUser(req));
      return ApiResponseHandler.success(res, SubjectiveTestMapper.test(updated), 'Subjective test updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'updateSubjectiveTest', serverErrorMessage: 'Failed to update subjective test' });
    }
  },

  async publishSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const { subjectiveTestId } = req.body as PublishSubjectiveTestRequestDto;
      const published = await subjectiveTestService.publish(businessId, subjectiveTestId, actingUser(req));
      return ApiResponseHandler.success(res, SubjectiveTestMapper.test(published), 'Subjective test published successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'publishSubjectiveTest', serverErrorMessage: 'Failed to publish subjective test' });
    }
  },

  async deleteSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      await subjectiveTestService.remove(businessId, req.params.subjectiveTestId!, actingUser(req));
      return ApiResponseHandler.success(res, null, 'Subjective test deleted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'deleteSubjectiveTest', serverErrorMessage: 'Failed to delete subjective test' });
    }
  },

  /** Shared path: staff need test access; students must have started the test. */
  async downloadQuestionPaper(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const user = actingUser(req);
      const ref = user.role === UserRole.STUDENT
        ? await subjectiveTestService.getQuestionPaperForStudent(businessId, subjectiveTestId, user)
        : await subjectiveTestService.getQuestionPaperForStaff(businessId, subjectiveTestId, user);
      return await streamPdf(res, ref);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadQuestionPaper', serverErrorMessage: 'Failed to download question paper' });
    }
  },

  // ---------------------------------------------------------------------------
  // Staff: submissions and grading
  // ---------------------------------------------------------------------------

  async listSubmissions(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const query = parseSubmissionListQuery(req.query);
      const result = await subjectiveTestService.listSubmissions(businessId, req.params.subjectiveTestId!, query, actingUser(req));
      return ApiResponseHandler.success(res, result, 'Submissions fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listSubmissions', serverErrorMessage: 'Failed to fetch submissions' });
    }
  },

  async getSubmissionForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submission = await subjectiveTestService.getSubmissionDetailForStaff(
        businessId,
        req.params.subjectiveTestId!,
        req.params.submissionId!,
        actingUser(req),
      );
      return ApiResponseHandler.success(res, submission, 'Submission fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getSubmissionForStaff', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  async downloadAnswerSheetForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const ref = await subjectiveTestService.getAnswerSheetForStaff(
        businessId,
        req.params.subjectiveTestId!,
        req.params.submissionId!,
        actingUser(req),
      );
      return await streamPdf(res, ref);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadAnswerSheetForStaff', serverErrorMessage: 'Failed to download answer sheet' });
    }
  },

  async downloadCheckedAnswerSheetForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const ref = await subjectiveTestService.getCheckedAnswerSheetForStaff(
        businessId,
        req.params.subjectiveTestId!,
        req.params.submissionId!,
        actingUser(req),
      );
      return await streamPdf(res, ref);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadCheckedAnswerSheetForStaff', serverErrorMessage: 'Failed to download checked answer sheet' });
    }
  },

  async gradeSubmission(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const graded = await subjectiveTestService.grade(
        businessId,
        req.params.subjectiveTestId!,
        req.params.submissionId!,
        req.body,
        req.file,
        actingUser(req),
      );
      return ApiResponseHandler.success(res, graded, 'Submission graded successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'gradeSubmission', serverErrorMessage: 'Failed to grade submission' });
    }
  },

  // ---------------------------------------------------------------------------
  // Student
  // ---------------------------------------------------------------------------

  async listAvailableSubjectiveTests(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const tests = await subjectiveTestService.listAvailable(businessId, actingUser(req));
      return ApiResponseHandler.success(res, tests, 'Available subjective tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listAvailableSubjectiveTests', serverErrorMessage: 'Failed to fetch available subjective tests' });
    }
  },

  async startSubjectiveTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const started = await subjectiveTestService.start(businessId, req.params.subjectiveTestId!, actingUser(req));
      return ApiResponseHandler.success(res, started, 'Subjective test started successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'startSubjectiveTest', serverErrorMessage: 'Failed to start subjective test' });
    }
  },

  async submitAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submitted = await subjectiveTestService.submit(businessId, req.params.subjectiveTestId!, req.file, actingUser(req));
      return ApiResponseHandler.success(res, submitted, 'Answer sheet submitted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'submitAnswerSheet', serverErrorMessage: 'Failed to submit answer sheet' });
    }
  },

  async getOwnSubmission(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submission = await subjectiveTestService.getOwnSubmissionDetail(businessId, req.params.submissionId!, actingUser(req));
      return ApiResponseHandler.success(res, submission, 'Submission fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getOwnSubmission', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  async downloadOwnAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const ref = await subjectiveTestService.getOwnAnswerSheet(businessId, req.params.submissionId!, actingUser(req));
      return await streamPdf(res, ref);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadOwnAnswerSheet', serverErrorMessage: 'Failed to download answer sheet' });
    }
  },

  async downloadOwnCheckedAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const ref = await subjectiveTestService.getOwnCheckedAnswerSheet(businessId, req.params.submissionId!, actingUser(req));
      return await streamPdf(res, ref);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadOwnCheckedAnswerSheet', serverErrorMessage: 'Failed to download checked answer sheet' });
    }
  },
};
