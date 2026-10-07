import { NextFunction, Response } from 'express';
import { AuthRequest } from '../dtos/auth.dto';
import {
  subjectiveTestService,
  type StaffSubmissionContext,
  type StudentOpenAttemptContext,
} from '../services/subjectiveTest.service';
import type { SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import { getBusinessId, getRequestActor, handleTestControllerError } from '../utils/testController.utils';

const LOADED_ACCESS_CONTEXT = 'subjectiveTestAccessContext';

/**
 * Runs the access check and loads the entity BEFORE the upload middleware, so a file is never
 * written to disk for a request that is not allowed. The loaded entity is reused by the controller.
 */
function checkAccessBeforeUpload<LoadedContext>(endpoint: string, loadContext: (req: AuthRequest) => Promise<LoadedContext>) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.locals[LOADED_ACCESS_CONTEXT] = await loadContext(req);
      next();
    } catch (error: unknown) {
      handleTestControllerError({ res, error, endpoint, serverErrorMessage: 'Failed to check access' });
    }
  };
}

export function getLoadedAccessContext<LoadedContext>(res: Response): LoadedContext {
  return res.locals[LOADED_ACCESS_CONTEXT] as LoadedContext;
}

export const requireDraftTestBeforeUpload = checkAccessBeforeUpload<SubjectiveTestRecord>('replaceQuestionPaper', (req) =>
  subjectiveTestService.findDraftTestForStaff(getBusinessId(req), req.params.subjectiveTestId!, getRequestActor(req)),
);

export const requireGradableSubmissionBeforeUpload = checkAccessBeforeUpload<StaffSubmissionContext>('gradeSubmission', (req) =>
  subjectiveTestService.findGradableSubmissionForStaff(
    getBusinessId(req),
    req.params.subjectiveTestId!,
    req.params.submissionId!,
    getRequestActor(req),
  ),
);

export const requireOpenAttemptBeforeUpload = checkAccessBeforeUpload<StudentOpenAttemptContext>('submitAnswerSheet', (req) =>
  subjectiveTestService.findOpenAttemptForStudent(getBusinessId(req), req.params.subjectiveTestId!, getRequestActor(req)),
);
