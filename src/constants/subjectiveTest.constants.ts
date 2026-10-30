/** Entity names used in errors such as `NotFoundError(label)` ("<label> not found"). */
export const SUBJECTIVE_TEST_LABELS = {
  SUBJECTIVE_TEST: 'Subjective test',
  SUBMISSION: 'Submission',
  QUESTION_PAPER: 'Question paper',
  ANSWER_SHEET: 'Answer sheet',
  CHECKED_ANSWER_SHEET: 'Checked answer sheet',
  FILE: 'File',
} as const;

/** Names given to downloaded PDFs (the `.pdf` extension comes from SUBJECTIVE_TEST_CONFIG). */
export const SUBJECTIVE_TEST_DOWNLOAD_NAMES = {
  DEFAULT_QUESTION_PAPER: 'Question paper',
  ANSWER_SHEET_SUFFIX: ' - answer sheet',
  CHECKED_COPY_SUFFIX: ' - checked copy',
} as const;

/** Query parameters of the staff test list and the submissions roster. */
export const SUBJECTIVE_TEST_QUERY_PARAMS = {
  STATUS: 'status',
  BATCH_ID: 'batchId',
  PAPER_TYPE: 'paperType',
  PAGE: 'page',
  LIMIT: 'limit',
  SEARCH: 'search',
} as const;

/**
 * Create/update DTO fields saved as sent (dates are converted separately). An explicit list, because the
 * DTO keeps unknown body properties (e.g. `status`, `createdBy`), which must never reach the DB.
 */
export const SUBJECTIVE_TEST_DTO_FIELDS = [
  'batchId',
  'subjectId',
  'name',
  'paperType',
  'description',
  'instructions',
  'totalMarks',
  'durationMinutes',
] as const;

/** Which attempt a student must already have for an action (start: none; question paper: started; submit: open). */
export const STUDENT_ATTEMPT_REQUIREMENT = {
  NONE: 'none',
  STARTED: 'started',
  OPEN: 'open',
} as const;

export type StudentAttemptRequirement = (typeof STUDENT_ATTEMPT_REQUIREMENT)[keyof typeof STUDENT_ATTEMPT_REQUIREMENT];
