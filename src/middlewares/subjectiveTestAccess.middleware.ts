import { NextFunction, Response } from 'express';
import { AuthRequest } from '../dtos/auth.dto';
import {
  subjectiveTestService,
  type SubmissionContext,
  type StudentOpenAttemptContext,
} from '../services/subjectiveTest.service';
import type { SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import { getBusinessId, getRequestActor, handleTestControllerError } from '../utils/testController.utils';
import { STUDENT_ATTEMPT_REQUIREMENT } from '../constants/subjectiveTest.constants';
import logger from '../utils/logger';

const LOADED_ACCESS_CONTEXT = 'subjectiveTestAccessContext';

/**
 * Runs the access check and loads the entity BEFORE the upload middleware, so a file is never
 * written to disk for a request that is not allowed. The loaded entity is reused by the controller.
 */
function checkAccessBeforeUpload<LoadedContext>(endpoint: string, loadContext: (req: AuthRequest) => Promise<LoadedContext>) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.locals[LOADED_ACCESS_CONTEXT] = await loadContext(req);
      logger.info(`[subjective-test-access] ${endpoint} allowed before upload userId=${req.user?.id} params=${JSON.stringify(req.params)}`);
      next();
    } catch (error: unknown) {
      logger.warn(
        `[subjective-test-access] ${endpoint} refused before upload userId=${req.user?.id} params=${JSON.stringify(req.params)} reason=${(error as Error).message}`,
      );
      handleTestControllerError({ res, error, endpoint, serverErrorMessage: 'Failed to check access' });
    }
  };
}

export function getLoadedAccessContext<LoadedContext>(res: Response): LoadedContext {
  return res.locals[LOADED_ACCESS_CONTEXT] as LoadedContext;
}

export const requireDraftTestBeforeUpload = checkAccessBeforeUpload<SubjectiveTestRecord>('replaceQuestionPaper', (req) =>
  subjectiveTestService.findTestForStaff(getBusinessId(req), req.params.subjectiveTestId!, getRequestActor(req), { draftOnly: true }),
);

export const requireGradableSubmissionBeforeUpload = checkAccessBeforeUpload<SubmissionContext>('gradeSubmission', (req) =>
  subjectiveTestService.findSubmission(getBusinessId(req), req.params.submissionId!, getRequestActor(req), { submittedOnly: true }),
);

export const requireOpenAttemptBeforeUpload = checkAccessBeforeUpload<StudentOpenAttemptContext>('submitAnswerSheet', (req) =>
  subjectiveTestService.findPublishedTestForStudent(
    getBusinessId(req),
    req.params.subjectiveTestId!,
    getRequestActor(req),
    STUDENT_ATTEMPT_REQUIREMENT.OPEN,
  ),
);
