import * as path from 'path';
import { FILE_EXTENSIONS, MIME_TYPES } from '../constants/file.constants';

const BYTES_IN_MB = 1024 * 1024;
const MAX_PDF_SIZE_MB = 20;

/**
 * Subjective test file settings. Kept in code (not env) on purpose.
 *
 * Files live under `privateRootDir`, which is outside `uploads/` so the public
 * `express.static('/uploads')` mount can never serve them. They are only streamed
 * through auth-checked endpoints.
 */
export const SUBJECTIVE_TEST_CONFIG = {
  privateRootDir: path.resolve(process.cwd(), 'private-uploads'),
  storagePrefix: 'subjective',
  tempSubDir: 'tmp',
  maxPdfSizeMb: MAX_PDF_SIZE_MB,
  maxPdfSizeBytes: MAX_PDF_SIZE_MB * BYTES_IN_MB,
  pdfExtension: FILE_EXTENSIONS.PDF,
  pdfMimeType: MIME_TYPES.PDF,
  fields: {
    questionPaper: 'questionPaper',
    answerSheet: 'answerSheet',
    checkedAnswerSheet: 'checkedAnswerSheet',
  },
  submissionsDefaultLimit: 20,
  submissionsMaxLimit: 100,
} as const;
