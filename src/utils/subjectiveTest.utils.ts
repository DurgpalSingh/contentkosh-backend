import { BadRequestError, NotFoundError } from '../errors/api.errors';
import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionFile,
  SubjectiveSubmissionStatus,
  isSubjectiveDisplayStatus,
  isSubjectiveSubmissionFile,
} from '../constants/test-enums';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
import {
  appendOriginalFileName,
  createUniqueFileName,
  createUniqueFileStem,
  extractOriginalFileName,
  uploadsFileStorage,
  toStorageSafeFileName,
  type StoredFileDownload,
} from '../services/fileStorage.service';
import { parseOptionalIntQueryParam, parseOptionalStringQueryParam } from './testController.utils';
import { pickDefined } from './objectUtils';
import logger from './logger';

/** Absorbs small client/server clock drift on window boundaries (same tolerance as Exam start). */
export const SUBJECTIVE_TIME_TOLERANCE_MS = 1000;

type TestSchedule = { startAt: Date; deadlineAt: Date; durationMinutes: number };
type AttemptTiming = { status: number; startedAt: Date };
type TestFileFields = { id: string; businessId: number; name: string; paperType: string; questionPaperPath: string | null };
type SubmissionFileFields = { id: string; answerSheetPath: string | null; checkedAnswerSheetPath: string | null };

// ---------------------------------------------------------------------------
// Time and status rules
// ---------------------------------------------------------------------------

/** A student must submit by the earlier of `startedAt + duration` and the test deadline. */
export function computeAttemptDeadline(schedule: TestSchedule, startedAt: Date): Date {
  const deadlineByDuration = new Date(startedAt.getTime() + schedule.durationMinutes * 60_000);
  return deadlineByDuration < schedule.deadlineAt ? deadlineByDuration : schedule.deadlineAt;
}

export function getTestAvailability(schedule: TestSchedule, now: Date): SubjectiveAvailability {
  const nowMs = now.getTime();
  if (nowMs + SUBJECTIVE_TIME_TOLERANCE_MS < schedule.startAt.getTime()) return SubjectiveAvailability.UPCOMING;
  if (nowMs > schedule.deadlineAt.getTime() + SUBJECTIVE_TIME_TOLERANCE_MS) return SubjectiveAvailability.CLOSED;
  return SubjectiveAvailability.OPEN;
}

/** EXPIRED is never stored: an IN_PROGRESS attempt past its deadline reads as EXPIRED. */
export function getSubmissionDisplayStatus(
  schedule: TestSchedule,
  attempt: AttemptTiming | null,
  now: Date,
): SubjectiveDisplayStatus {
  if (!attempt) return SubjectiveDisplayStatus.NOT_STARTED;
  if (attempt.status === SubjectiveSubmissionStatus.CHECKED) return SubjectiveDisplayStatus.CHECKED;
  if (attempt.status === SubjectiveSubmissionStatus.SUBMITTED) return SubjectiveDisplayStatus.SUBMITTED;
  const attemptDeadlineMs = computeAttemptDeadline(schedule, attempt.startedAt).getTime();
  return now.getTime() > attemptDeadlineMs + SUBJECTIVE_TIME_TOLERANCE_MS
    ? SubjectiveDisplayStatus.EXPIRED
    : SubjectiveDisplayStatus.IN_PROGRESS;
}

/** Create/update can't cross-check two fields in the DTO, so the schedule order is checked here. */
export function assertDeadlineAfterStart(startAt: Date, deadlineAt: Date): void {
  if (deadlineAt <= startAt) {
    logger.warn(`[subjective-test] schedule rejected: deadline not after start startAt=${startAt.toISOString()} deadlineAt=${deadlineAt.toISOString()}`);
    throw new BadRequestError('Deadline must be after the start time');
  }
}

/**
 * Fields a draft edit may change as sent (dates are converted separately). An explicit list, because the
 * DTO keeps unknown body properties (e.g. `status`), which must never reach the DB.
 */
export const DRAFT_TEST_EDITABLE_FIELDS = [
  'batchId',
  'subjectId',
  'name',
  'paperType',
  'description',
  'instructions',
  'totalMarks',
  'durationMinutes',
] as const;

// ---------------------------------------------------------------------------
// Storage keys: subjective/<businessId>/<testId>/...  (a new key per upload, never overwritten)
// ---------------------------------------------------------------------------

export function subjectiveTestStorageFolder(businessId: number, subjectiveTestId: string): string {
  return uploadsFileStorage.joinStorageKey(SUBJECTIVE_TEST_CONFIG.storageFolder, businessId, subjectiveTestId);
}

export function buildQuestionPaperStorageKey(businessId: number, subjectiveTestId: string): string {
  const questionPaperStorageKey = uploadsFileStorage.joinStorageKey(
    subjectiveTestStorageFolder(businessId, subjectiveTestId),
    createUniqueFileName('question-paper', SUBJECTIVE_TEST_CONFIG.pdfExtension),
  );
  logger.debug(`[subjective-test] question paper storage key built storageKey=${questionPaperStorageKey}`);
  return questionPaperStorageKey;
}

/** Keeps the student's original file name inside the key so it can be shown later. */
export function buildAnswerSheetStorageKey(
  businessId: number,
  subjectiveTestId: string,
  studentId: number,
  uploadedFile: Express.Multer.File,
): string {
  const answerSheetStorageKey = uploadsFileStorage.joinStorageKey(
    subjectiveTestStorageFolder(businessId, subjectiveTestId),
    'answers',
    appendOriginalFileName(createUniqueFileStem(studentId), toStorageSafeFileName(uploadedFile)),
  );
  logger.debug(`[subjective-test] answer sheet storage key built storageKey=${answerSheetStorageKey}`);
  return answerSheetStorageKey;
}

export function buildCheckedCopyStorageKey(businessId: number, subjectiveTestId: string, submissionId: string): string {
  const checkedCopyStorageKey = uploadsFileStorage.joinStorageKey(
    subjectiveTestStorageFolder(businessId, subjectiveTestId),
    'checked',
    createUniqueFileName(submissionId, SUBJECTIVE_TEST_CONFIG.pdfExtension),
  );
  logger.debug(`[subjective-test] checked copy storage key built storageKey=${checkedCopyStorageKey}`);
  return checkedCopyStorageKey;
}

// ---------------------------------------------------------------------------
// Display names and download descriptors
// ---------------------------------------------------------------------------

/** The question paper is named after the paper type, e.g. "GS Paper I.pdf". */
export function questionPaperDisplayName(test: Pick<TestFileFields, 'paperType' | 'questionPaperPath'>): string | null {
  return test.questionPaperPath ? `${test.paperType.trim() || 'Question paper'}.pdf` : null;
}

export function answerSheetDisplayName(answerSheetPath: string | null): string | null {
  return extractOriginalFileName(answerSheetPath);
}

const pdfDownload = (storageKey: string | null, downloadFileName: string, missingFileLabel: string): StoredFileDownload => {
  if (!storageKey) {
    logger.warn(`[subjective-test] download rejected: no file stored file=${missingFileLabel}`);
    throw new NotFoundError(missingFileLabel);
  }
  logger.debug(`[subjective-test] download prepared file=${missingFileLabel} storageKey=${storageKey}`);
  return { storageKey, downloadFileName, contentType: SUBJECTIVE_TEST_CONFIG.pdfMimeType };
};

export function questionPaperDownload(test: TestFileFields): StoredFileDownload {
  return pdfDownload(test.questionPaperPath, questionPaperDisplayName(test) ?? '', 'Question paper');
}

/** Reads the requested submission file from the last URL segment (`answer-sheet` / `checked-answer-sheet`). */
export function parseSubmissionFile(urlSegment: unknown): SubjectiveSubmissionFile {
  if (!isSubjectiveSubmissionFile(urlSegment)) {
    logger.warn(`[subjective-test] download rejected: unknown submission file file=${String(urlSegment)}`);
    throw new NotFoundError('File');
  }
  return urlSegment;
}

/** The checked copy path is only ever saved together with CHECKED, so a missing path covers "not checked yet". */
export function submissionFileDownload(
  test: TestFileFields,
  submission: SubmissionFileFields,
  submissionFile: SubjectiveSubmissionFile,
): StoredFileDownload {
  if (submissionFile === SubjectiveSubmissionFile.CHECKED_COPY) {
    return pdfDownload(submission.checkedAnswerSheetPath, `${test.name} - checked copy.pdf`, 'Checked answer sheet');
  }
  return pdfDownload(
    submission.answerSheetPath,
    answerSheetDisplayName(submission.answerSheetPath) ?? `${test.name} - answer sheet.pdf`,
    'Answer sheet',
  );
}

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

export type SubmissionListFilters = {
  displayStatus?: SubjectiveDisplayStatus;
  searchText?: string;
  page: number;
  pageSize: number;
};

export type StaffTestListFilters = { status?: number; batchId?: number; paperType?: string };

export function parseStaffTestListFilters(query: Record<string, unknown>): StaffTestListFilters {
  const filters = pickDefined(
    {
      status: parseOptionalIntQueryParam(query.status, 'status'),
      batchId: parseOptionalIntQueryParam(query.batchId, 'batchId'),
      paperType: parseOptionalStringQueryParam(query.paperType, 'paperType'),
    },
    ['status', 'batchId', 'paperType'],
  );
  logger.debug(`[subjective-test] staff test list filters parsed filters=${JSON.stringify(filters)}`);
  return filters;
}

function rejectInvalidListFilter(message: string, query: Record<string, unknown>): never {
  logger.warn(`[subjective-test] submission list filters rejected reason="${message}" query=${JSON.stringify(query)}`);
  throw new BadRequestError(message);
}

export function parseSubmissionListFilters(query: Record<string, unknown>): SubmissionListFilters {
  const displayStatus = parseOptionalStringQueryParam(query.status, 'status');
  if (displayStatus !== undefined && !isSubjectiveDisplayStatus(displayStatus)) rejectInvalidListFilter('Invalid status', query);
  const page = parseOptionalIntQueryParam(query.page, 'page') ?? 1;
  const pageSize = parseOptionalIntQueryParam(query.limit, 'limit') ?? SUBJECTIVE_TEST_CONFIG.submissionsDefaultPageSize;
  if (page < 1) rejectInvalidListFilter('Invalid page', query);
  if (pageSize < 1) rejectInvalidListFilter('Invalid limit', query);
  const filters: SubmissionListFilters = {
    ...pickDefined(
      {
        displayStatus,
        searchText: parseOptionalStringQueryParam(query.search, 'search')?.trim().toLowerCase() || undefined,
      },
      ['displayStatus', 'searchText'],
    ),
    page,
    pageSize: Math.min(pageSize, SUBJECTIVE_TEST_CONFIG.submissionsMaxPageSize),
  };
  logger.debug(`[subjective-test] submission list filters parsed filters=${JSON.stringify(filters)}`);
  return filters;
}
