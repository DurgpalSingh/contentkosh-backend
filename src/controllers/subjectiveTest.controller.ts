import { Response } from 'express';
import { ApiResponseHandler } from '../utils/apiResponse';
import { AuthRequest } from '../dtos/auth.dto';
import { PublishSubjectiveTestRequestDto } from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import {
  subjectiveTestService,
  type StaffSubmissionContext,
  type StudentOpenAttemptContext,
} from '../services/subjectiveTest.service';
import { privateFileStorage } from '../services/fileStorage.service';
import type { SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import { getLoadedAccessContext } from '../middlewares/subjectiveTestAccess.middleware';
import { parseSubmissionListFilters } from '../utils/subjectiveTest.utils';
import {
  getBusinessId,
  getRequestActor,
  handleTestControllerError,
  parseOptionalIntQueryParam,
  parseOptionalStringQueryParam,
} from '../utils/testController.utils';

export const subjectiveTestController = {
  // ---------------------------------------------------------------------------
  // Staff: manage tests
  // ---------------------------------------------------------------------------

  async createDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const draftTest = await subjectiveTestService.createDraftTest(businessId, req.body, getRequestActor(req));
      return ApiResponseHandler.created(res, SubjectiveTestMapper.toStaffTestResponse(draftTest), 'Subjective test created successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'createDraftTest', serverErrorMessage: 'Failed to create subjective test' });
    }
  },

  async listTestsForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const status = parseOptionalIntQueryParam(req.query.status, 'status');
      const batchId = parseOptionalIntQueryParam(req.query.batchId, 'batchId');
      const paperType = parseOptionalStringQueryParam(req.query.paperType, 'paperType');

      const filters = {
        ...(status !== undefined ? { status } : {}),
        ...(batchId !== undefined ? { batchId } : {}),
        ...(paperType !== undefined ? { paperType } : {}),
      };

      const tests = await subjectiveTestService.listTestsForStaff(businessId, filters, getRequestActor(req));
      return ApiResponseHandler.success(res, tests.map(SubjectiveTestMapper.toStaffTestResponse), 'Subjective tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listTestsForStaff', serverErrorMessage: 'Failed to fetch subjective tests' });
    }
  },

  async getTestDetailForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const { test, submissionCounts } = await subjectiveTestService.getTestDetailForStaff(businessId, subjectiveTestId, getRequestActor(req));
      return ApiResponseHandler.success(
        res,
        { ...SubjectiveTestMapper.toStaffTestResponse(test), submissionCounts },
        'Subjective test fetched successfully',
      );
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getTestDetailForStaff', serverErrorMessage: 'Failed to fetch subjective test' });
    }
  },

  async updateDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const updatedTest = await subjectiveTestService.updateDraftTest(businessId, subjectiveTestId, req.body, getRequestActor(req));
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(updatedTest), 'Subjective test updated successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'updateDraftTest', serverErrorMessage: 'Failed to update subjective test' });
    }
  },

  /** The draft test was loaded and access-checked before the upload (requireDraftTestBeforeUpload). */
  async replaceQuestionPaper(req: AuthRequest, res: Response) {
    try {
      const draftTest = getLoadedAccessContext<SubjectiveTestRecord>(res);
      const updatedTest = await subjectiveTestService.replaceQuestionPaper(draftTest, req.file!, getRequestActor(req));
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(updatedTest), 'Question paper uploaded successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'replaceQuestionPaper', serverErrorMessage: 'Failed to upload question paper' });
    }
  },

  async publishDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const { subjectiveTestId } = req.body as PublishSubjectiveTestRequestDto;
      const publishedTest = await subjectiveTestService.publishDraftTest(businessId, subjectiveTestId, getRequestActor(req));
      return ApiResponseHandler.success(res, SubjectiveTestMapper.toStaffTestResponse(publishedTest), 'Subjective test published successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'publishDraftTest', serverErrorMessage: 'Failed to publish subjective test' });
    }
  },

  async deleteDraftTest(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      await subjectiveTestService.deleteDraftTest(businessId, subjectiveTestId, getRequestActor(req));
      return ApiResponseHandler.success(res, null, 'Subjective test deleted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'deleteDraftTest', serverErrorMessage: 'Failed to delete subjective test' });
    }
  },

  /** Staff can always download; students only after they started the test. */
  async downloadQuestionPaper(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const questionPaperDownload = await subjectiveTestService.getQuestionPaperDownload(businessId, subjectiveTestId, getRequestActor(req));
      return await privateFileStorage.streamToResponse(res, questionPaperDownload);
    } catch (e: unknown) {
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
      return ApiResponseHandler.success(res, rosterPage, 'Submissions fetched successfully');
    } catch (e: unknown) {
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
      return ApiResponseHandler.success(res, submissionDetail, 'Submission fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getSubmissionDetailForStaff', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  async downloadAnswerSheetForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const submissionId = req.params.submissionId!;
      const answerSheetDownload = await subjectiveTestService.getAnswerSheetDownloadForStaff(
        businessId,
        subjectiveTestId,
        submissionId,
        getRequestActor(req),
      );
      return await privateFileStorage.streamToResponse(res, answerSheetDownload);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadAnswerSheetForStaff', serverErrorMessage: 'Failed to download answer sheet' });
    }
  },

  async downloadCheckedCopyForStaff(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const submissionId = req.params.submissionId!;
      const checkedCopyDownload = await subjectiveTestService.getCheckedCopyDownloadForStaff(
        businessId,
        subjectiveTestId,
        submissionId,
        getRequestActor(req),
      );
      return await privateFileStorage.streamToResponse(res, checkedCopyDownload);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadCheckedCopyForStaff', serverErrorMessage: 'Failed to download checked answer sheet' });
    }
  },

  /** The submission was loaded and access-checked before the upload (requireGradableSubmissionBeforeUpload). */
  async gradeSubmission(req: AuthRequest, res: Response) {
    try {
      const gradableSubmission = getLoadedAccessContext<StaffSubmissionContext>(res);
      const gradedSubmission = await subjectiveTestService.gradeSubmission(gradableSubmission, req.body, req.file, getRequestActor(req));
      return ApiResponseHandler.success(res, gradedSubmission, 'Submission graded successfully');
    } catch (e: unknown) {
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
      return ApiResponseHandler.success(res, testCards, 'Available subjective tests fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'listTestsForStudent', serverErrorMessage: 'Failed to fetch available subjective tests' });
    }
  },

  async startOrResumeAttempt(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const subjectiveTestId = req.params.subjectiveTestId!;
      const startedAttempt = await subjectiveTestService.startOrResumeAttempt(businessId, subjectiveTestId, getRequestActor(req));
      return ApiResponseHandler.success(res, startedAttempt, 'Subjective test started successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'startOrResumeAttempt', serverErrorMessage: 'Failed to start subjective test' });
    }
  },

  /** The open attempt was loaded and checked before the upload (requireOpenAttemptBeforeUpload). */
  async submitAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const openAttempt = getLoadedAccessContext<StudentOpenAttemptContext>(res);
      const submittedAttempt = await subjectiveTestService.submitAnswerSheet(openAttempt, req.file!, getRequestActor(req));
      return ApiResponseHandler.success(res, submittedAttempt, 'Answer sheet submitted successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'submitAnswerSheet', serverErrorMessage: 'Failed to submit answer sheet' });
    }
  },

  async getOwnAttemptDetail(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const ownAttempt = await subjectiveTestService.getOwnAttemptDetail(businessId, submissionId, getRequestActor(req));
      return ApiResponseHandler.success(res, ownAttempt, 'Submission fetched successfully');
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'getOwnAttemptDetail', serverErrorMessage: 'Failed to fetch submission' });
    }
  },

  async downloadOwnAnswerSheet(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const answerSheetDownload = await subjectiveTestService.getOwnAnswerSheetDownload(businessId, submissionId, getRequestActor(req));
      return await privateFileStorage.streamToResponse(res, answerSheetDownload);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadOwnAnswerSheet', serverErrorMessage: 'Failed to download answer sheet' });
    }
  },

  async downloadOwnCheckedCopy(req: AuthRequest, res: Response) {
    try {
      const businessId = getBusinessId(req);
      const submissionId = req.params.submissionId!;
      const checkedCopyDownload = await subjectiveTestService.getOwnCheckedCopyDownload(businessId, submissionId, getRequestActor(req));
      return await privateFileStorage.streamToResponse(res, checkedCopyDownload);
    } catch (e: unknown) {
      return handleTestControllerError({ res, error: e, endpoint: 'downloadOwnCheckedCopy', serverErrorMessage: 'Failed to download checked answer sheet' });
    }
  },
};
