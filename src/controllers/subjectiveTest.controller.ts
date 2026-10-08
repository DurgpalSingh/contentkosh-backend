import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import logger from '../utils/logger';
import { AuthRequest } from '../dtos/auth.dto';
import { PublishSubjectiveTestRequestDto } from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import {
  subjectiveTestService,
  type StaffSubmissionContext,
  type StudentOpenAttemptContext,
} from '../services/subjectiveTest.service';
import { uploadsFileStorage } from '../services/fileStorage.service';
import type { SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import { getLoadedAccessContext } from '../middlewares/subjectiveTestAccess.middleware';
import { parseStaffTestListFilters, parseSubmissionFile, parseSubmissionListFilters } from '../utils/subjectiveTest.utils';
import { getBusinessId, getRequestActor, handleTestControllerError } from '../utils/testController.utils';

export const subjectiveTestController = {
  // ---------------------------------------------------------------------------
  // Staff: manage tests
  // ---------------------------------------------------------------------------

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

  async getTestDetailForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const { test, submissionCounts } = await subjectiveTestService.getTestDetailForStaff(businessId, subjectiveTestId, getRequestActor(req));
      logger.info(`[subjective-test-controller] getTestDetailForStaff success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(
        res,
        { ...SubjectiveTestMapper.toStaffTestResponse(test), submissionCounts },
        'Subjective test fetched successfully',
      );
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] getTestDetailForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'getTestDetailForStaff', serverErrorMessage: 'Failed to fetch subjective test' });
    }
  },

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

  /** The draft test was loaded and access-checked before the upload (requireDraftTestBeforeUpload). */
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

  /** Staff can always download; students only after they started the test. */
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

  // ---------------------------------------------------------------------------
  // Staff: submissions and grading
  // ---------------------------------------------------------------------------

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

  async getSubmissionDetailForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const submissionId = req.params.submissionId!;
      const submissionDetail = await subjectiveTestService.getSubmissionDetailForStaff(
        businessId,
        subjectiveTestId,
        submissionId,
        getRequestActor(req),
      );
      logger.info(`[subjective-test-controller] getSubmissionDetailForStaff success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, submissionDetail, 'Submission fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] getSubmissionDetailForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'getSubmissionDetailForStaff', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  /** Serves both `answer-sheet` and `checked-answer-sheet` (the `submissionFile` route param). */
  async downloadSubmissionFileForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const submissionId = req.params.submissionId!;
      const submissionFile = parseSubmissionFile(req.params.submissionFile);
      const submissionFileDownload = await subjectiveTestService.getSubmissionFileDownloadForStaff(
        businessId,
        subjectiveTestId,
        submissionId,
        submissionFile,
        getRequestActor(req),
      );
      logger.info(`[subjective-test-controller] downloadSubmissionFileForStaff streaming file userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return await uploadsFileStorage.streamToResponse(res, submissionFileDownload);
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] downloadSubmissionFileForStaff failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'downloadSubmissionFileForStaff', serverErrorMessage: 'Failed to download file' });
    }
  },

  /** The submission was loaded and access-checked before the upload (requireGradableSubmissionBeforeUpload). */
  async gradeSubmission(req: AuthRequest, res: Response) {
    try {
      const gradableSubmission = getLoadedAccessContext<StaffSubmissionContext>(res);
      const gradedSubmission = await subjectiveTestService.gradeSubmission(gradableSubmission, req.body, req.file, getRequestActor(req));
      logger.info(`[subjective-test-controller] gradeSubmission success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, gradedSubmission, 'Submission graded successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] gradeSubmission failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'gradeSubmission', serverErrorMessage: 'Failed to grade submission' });
    }
  },

  // ---------------------------------------------------------------------------
  // Student
  // ---------------------------------------------------------------------------

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

  /** The open attempt was loaded and checked before the upload (requireOpenAttemptBeforeUpload). */
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

  async getOwnAttemptDetail(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const ownAttempt = await subjectiveTestService.getOwnAttemptDetail(businessId, submissionId, getRequestActor(req));
      logger.info(`[subjective-test-controller] getOwnAttemptDetail success userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return ApiResponseHandler.success(res, ownAttempt, 'Submission fetched successfully');
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] getOwnAttemptDetail failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'getOwnAttemptDetail', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  /** Serves both `answer-sheet` and `checked-answer-sheet` (the `submissionFile` route param). */
  async downloadOwnSubmissionFile(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const submissionFile = parseSubmissionFile(req.params.submissionFile);
      const submissionFileDownload = await subjectiveTestService.getOwnSubmissionFileDownload(
        businessId,
        submissionId,
        submissionFile,
        getRequestActor(req),
      );
      logger.info(`[subjective-test-controller] downloadOwnSubmissionFile streaming file userId=${req.user!.id} params=${JSON.stringify(req.params)}`);
      return await uploadsFileStorage.streamToResponse(res, submissionFileDownload);
    } catch (e: unknown) {
      logger.warn(`[subjective-test-controller] downloadOwnSubmissionFile failed userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(e as Error).message}`);
      return handleTestControllerError({ res, error: e, endpoint: 'downloadOwnSubmissionFile', serverErrorMessage: 'Failed to download file' });
    }
  },
};
