import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { AuthRequest } from '../dtos/auth.dto';
import { PublishSubjectiveTestRequestDto } from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import {
  subjectiveTestService,
  type SubmissionContext,
  type StudentOpenAttemptContext,
} from '../services/subjectiveTest.service';
import { uploadsFileStorage } from '../services/fileStorage.service';
import type { SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import { getLoadedAccessContext } from '../middlewares/subjectiveTestAccess.middleware';
import { parseStaffTestListFilters, parseSubmissionFile, parseSubmissionListFilters } from '../utils/subjectiveTest.utils';
import { getBusinessId, getRequestActor, handleTestControllerError } from '../utils/testController.utils';

/**
 * replaceQuestionPaper, submitAnswerSheet and gradeSubmission get the entity that
 * subjectiveTestAccess.middleware loaded and access-checked before the upload ran.
 */
export const subjectiveTestController = {
  // GET

  async listTestsForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const filters = parseStaffTestListFilters(req.query);
      const tests = await subjectiveTestService.listTestsForStaff(businessId, filters, getRequestActor(req));
      logger.info(`[subjective-test-controller] listTestsForStaff success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, tests.map(SubjectiveTestMapper.toStaffTestResponse), 'Subjective tests fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] listTestsForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'listTestsForStaff', serverErrorMessage: 'Failed to fetch subjective tests' });
    }
  },

  async listTestsForStudent(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const testCards = await subjectiveTestService.listTestsForStudent(businessId, getRequestActor(req));
      logger.info(`[subjective-test-controller] listTestsForStudent success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, testCards, 'Available subjective tests fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] listTestsForStudent failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'listTestsForStudent', serverErrorMessage: 'Failed to fetch available subjective tests' });
    }
  },

  async getTestDetailForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const { subjectiveTest, submissionCounts } = await subjectiveTestService.getTestDetailForStaff(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] getTestDetailForStaff success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(
        res,
        { ...SubjectiveTestMapper.toStaffTestResponse(subjectiveTest), submissionCounts },
        'Subjective test fetched successfully',
      );
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] getTestDetailForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'getTestDetailForStaff', serverErrorMessage: 'Failed to fetch subjective test' });
    }
  },

  async downloadQuestionPaper(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const questionPaperDownload = await subjectiveTestService.getQuestionPaperDownload(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] downloadQuestionPaper streaming file userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return await uploadsFileStorage.streamToResponse(res, questionPaperDownload);
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] downloadQuestionPaper failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'downloadQuestionPaper', serverErrorMessage: 'Failed to download question paper' });
    }
  },

  async listRosterForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const filters = parseSubmissionListFilters(req.query);
      const rosterPage = await subjectiveTestService.listRosterForStaff(businessId, subjectiveTestId, filters, getRequestActor(req));
      logger.info(`[subjective-test-controller] listRosterForStaff success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, rosterPage, 'Submissions fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] listRosterForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'listRosterForStaff', serverErrorMessage: 'Failed to fetch submissions' });
    }
  },

  async getSubmissionDetail(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const submissionDetail = await subjectiveTestService.getSubmissionDetail(businessId, submissionId, getRequestActor(req));
      logger.info(`[subjective-test-controller] getSubmissionDetail success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, submissionDetail, 'Submission fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] getSubmissionDetail failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'getSubmissionDetail', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  async downloadSubmissionFile(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const submissionFile = parseSubmissionFile(req.params.submissionFile);
      const submissionFileDownload = await subjectiveTestService.getSubmissionFileDownload(
        businessId,
        submissionId,
        submissionFile,
        getRequestActor(req),
      );
      logger.info(`[subjective-test-controller] downloadSubmissionFile streaming file userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return await uploadsFileStorage.streamToResponse(res, submissionFileDownload);
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] downloadSubmissionFile failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'downloadSubmissionFile', serverErrorMessage: 'Failed to download file' });
    }
  },

  // POST

  async createDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const draftTest = await subjectiveTestService.createDraftTest(businessId, req.body, getRequestActor(req));
      logger.info(`[subjective-test-controller] createDraftTest success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.created(res, SubjectiveTestMapper.toStaffTestResponse(draftTest), 'Subjective test created successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] createDraftTest failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'createDraftTest', serverErrorMessage: 'Failed to create subjective test' });
    }
  },

  async publishDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const { subjectiveTestId } = req.body as PublishSubjectiveTestRequestDto;
      const publishedTest = await subjectiveTestService.publishDraftTest(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] publishDraftTest success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(publishedTest), 'Subjective test published successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] publishDraftTest failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'publishDraftTest', serverErrorMessage: 'Failed to publish subjective test' });
    }
  },

  async startOrResumeAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const startedAttempt = await subjectiveTestService.startOrResumeAttempt(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] startOrResumeAttempt success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, startedAttempt, 'Subjective test started successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] startOrResumeAttempt failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'startOrResumeAttempt', serverErrorMessage: 'Failed to start subjective test' });
    }
  },

  async submitAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const openAttempt = getLoadedAccessContext<StudentOpenAttemptContext>(res);
      const submittedAttempt = await subjectiveTestService.submitAnswerSheet(openAttempt, req.file!, getRequestActor(req));
      logger.info(`[subjective-test-controller] submitAnswerSheet success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, submittedAttempt, 'Answer sheet submitted successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] submitAnswerSheet failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'submitAnswerSheet', serverErrorMessage: 'Failed to submit answer sheet' });
    }
  },

  // PUT

  async updateDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const updatedTest = await subjectiveTestService.updateDraftTest(businessId, subjectiveTestId, req.body, getRequestActor(req));
      logger.info(`[subjective-test-controller] updateDraftTest success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(updatedTest), 'Subjective test updated successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] updateDraftTest failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'updateDraftTest', serverErrorMessage: 'Failed to update subjective test' });
    }
  },

  async replaceQuestionPaper(req: AuthRequest, res: Response) {
    try {
      const draftTest = getLoadedAccessContext<SubjectiveTestRecord>(res);
      const updatedTest = await subjectiveTestService.replaceQuestionPaper(draftTest, req.file!, getRequestActor(req));
      logger.info(`[subjective-test-controller] replaceQuestionPaper success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(updatedTest), 'Question paper uploaded successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] replaceQuestionPaper failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'replaceQuestionPaper', serverErrorMessage: 'Failed to upload question paper' });
    }
  },

  async gradeSubmission(req: AuthRequest, res: Response) {
    try {
      const gradableSubmission = getLoadedAccessContext<SubmissionContext>(res);
      const gradedSubmission = await subjectiveTestService.gradeSubmission(gradableSubmission, req.body, req.file, getRequestActor(req));
      logger.info(`[subjective-test-controller] gradeSubmission success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, gradedSubmission, 'Submission graded successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] gradeSubmission failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'gradeSubmission', serverErrorMessage: 'Failed to grade submission' });
    }
  },

  // DELETE

  async deleteDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      await subjectiveTestService.deleteDraftTest(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] deleteDraftTest success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, null, 'Subjective test deleted successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] deleteDraftTest failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'deleteDraftTest', serverErrorMessage: 'Failed to delete subjective test' });
    }
  },
};
