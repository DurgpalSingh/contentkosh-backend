import { FILE_EXTENSIONS, MIME_TYPES } from '../constants/file.constants';

const BYTES_IN_MB = 1024 * 1024;
const MAX_PDF_SIZE_MB = 20;

/** Subjective test file rules. Kept in code (not env) on purpose. Files live in `uploads/subjective` (API-only, never served by URL). */
export const SUBJECTIVE_TEST_CONFIG = {
  storageFolder: 'subjective',
  /** Layout inside `subjective/<businessId>/<testId>/`. */
  storageNames: {
    questionPaperFilePrefix: 'question-paper',
    answerSheetsFolder: 'answers',
    checkedCopiesFolder: 'checked',
  },
  maxPdfSizeMb: MAX_PDF_SIZE_MB,
  maxPdfSizeBytes: MAX_PDF_SIZE_MB * BYTES_IN_MB,
  pdfExtension: FILE_EXTENSIONS.PDF,
  pdfMimeType: MIME_TYPES.PDF,
  uploadFieldNames: {
    questionPaper: 'questionPaper',
    answerSheet: 'answerSheet',
    checkedAnswerSheet: 'checkedAnswerSheet',
  },
  /** Absorbs small client/server clock drift on window boundaries (same tolerance as Exam start). Used in JS and SQL rules. */
  timeToleranceMs: 1000,
  firstPage: 1,
  submissionsDefaultPageSize: 20,
  submissionsMaxPageSize: 100,
} as const;
