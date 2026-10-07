/**
 * subjectiveTest.routes.test.ts
 * Route-level tests: role guards, route order, access checks BEFORE uploads (no file written for
 * refused requests), PDF validation (extension, mimetype, signature, size) and temp-file cleanup.
 * Repos and the final file move are mocked; multer writes real temp files.
 */

import * as fs from 'fs';
import request from 'supertest';
import express from 'express';
import { UserRole } from '@prisma/client';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { subjectiveTestRouter } from '../../../src/routes/subjectiveTest.routes';
import { SUBJECTIVE_TEST_CONFIG } from '../../../src/config/subjectiveTest.config';
import { FILE_STORAGE_CONFIG } from '../../../src/config/fileStorage.config';
import { SubjectiveSubmissionStatus, TestStatus } from '../../../src/constants/test-enums';
import * as subjectiveTestRepo from '../../../src/repositories/subjectiveTest.repo';
import * as batchRepo from '../../../src/repositories/batch.repo';
import { uploadsFileStorage } from '../../../src/services/fileStorage.service';

// An isolated uploads root, so temp-file counts aren't affected by other test files running in parallel.
jest.mock('../../../src/config/fileStorage.config', () => {
  const actualConfig = jest.requireActual('../../../src/config/fileStorage.config');
  const isolatedUploadsRoot = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'subjective-routes-'));
  return {
    ...actualConfig,
    FILE_STORAGE_CONFIG: {
      ...actualConfig.FILE_STORAGE_CONFIG,
      uploadsRootDir: isolatedUploadsRoot,
      uploadsTempDir: require('path').join(isolatedUploadsRoot, 'tmp'),
    },
  };
});
jest.mock('../../../src/repositories/subjectiveTest.repo');
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/services/fileStorage.service', () => ({
  ...jest.requireActual('../../../src/services/fileStorage.service'),
  uploadsFileStorage: {
    joinStorageKey: (...keyParts: Array<string | number>) => keyParts.join('/'),
    saveUploadThenCommit: jest.fn(),
    deleteFolderIfExists: jest.fn(),
    streamToResponse: jest.fn(),
  },
}));

let mockUserRole: UserRole = UserRole.ADMIN;
let mockUserId = 1;

jest.mock('../../../src/middlewares/auth.middleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (...roles: any[]) => (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  },
}));

jest.mock('../../../src/middlewares/validation.middleware', () => ({
  validateIdParam: () => (_req: any, _res: any, next: any) => next(),
  validateStringIdParam: () => (_req: any, _res: any, next: any) => next(),
  authorizeBusinessAccess: (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: mockUserId, role: mockUserRole, businessId: 1, email: 'test@test.com' };
  next();
});
app.use('/api/business', subjectiveTestRouter);
app.use(errorHandler);

const repo = subjectiveTestRepo as jest.Mocked<typeof subjectiveTestRepo>;
const fileStorage = uploadsFileStorage as jest.Mocked<typeof uploadsFileStorage>;
const HOUR = 3_600_000;
const BASE = '/api/business/1/subjective-tests';
const TEMP_DIR = FILE_STORAGE_CONFIG.uploadsTempDir;
const REAL_PDF = Buffer.from('%PDF-1.4\n%fake but valid header\n');
const FAKE_PDF = Buffer.from('MZ this is not a pdf');
const PDF_ATTACHMENT = { filename: 'paper.pdf', contentType: 'application/pdf' };

const DRAFT_TEST: subjectiveTestRepo.SubjectiveTestRecord = {
  id: 'st-1',
  businessId: 1,
  batchId: 3,
  batch: { id: 3, displayName: 'Batch A' },
  subjectId: null,
  subject: null,
  name: 'Mains Mock 4',
  paperType: 'GS Paper I',
  description: null,
  instructions: null,
  status: TestStatus.DRAFT,
  totalMarks: 250,
  durationMinutes: 180,
  startAt: new Date(Date.now() + HOUR),
  deadlineAt: new Date(Date.now() + 5 * HOUR),
  questionPaperPath: null,
  createdBy: 1,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SUBMITTED_SHEET: subjectiveTestRepo.SubjectiveSubmissionRecord = {
  id: 'sub-1',
  subjectiveTestId: 'st-1',
  studentId: 42,
  status: SubjectiveSubmissionStatus.SUBMITTED,
  startedAt: new Date(),
  submittedAt: new Date(),
  answerSheetPath: 'a.pdf',
  marksAwarded: null,
  remarks: null,
  checkedAnswerSheetPath: null,
  checkedBy: null,
  checkedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const tempFileCount = () => (fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR).length : 0);
/** Temp cleanup runs on response 'finish'; give the fs.rm a tick to complete. */
const waitForTempCleanup = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Subjective test routes', () => {
  // Temp files from the previous test are removed asynchronously after its response finishes.
  afterEach(waitForTempCleanup);

  beforeEach(() => {
    mockUserRole = UserRole.ADMIN;
    mockUserId = 1;
    (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
    fileStorage.saveUploadThenCommit.mockImplementation(async ({ commitToDatabase }) => commitToDatabase());
  });

  describe('role guards and route order', () => {
    it('blocks students from staff routes and staff from starting a test', async () => {
      mockUserRole = UserRole.STUDENT;
      expect((await request(app).get(BASE)).status).toBe(403);
      mockUserRole = UserRole.ADMIN;
      expect((await request(app).post(`${BASE}/st-1/start`).send({})).status).toBe(403);
    });

    it('routes /available and /submissions/:id to the student endpoints, not the :id route', async () => {
      mockUserRole = UserRole.STUDENT;
      repo.findPublishedTestsWithOwnAttempt.mockResolvedValue([]);
      expect((await request(app).get(`${BASE}/available`)).status).toBe(200);

      repo.findOwnSubmissionWithTest.mockResolvedValue(null);
      const ownSubmissionResponse = await request(app).get(`${BASE}/submissions/sub-1`);
      expect(ownSubmissionResponse.status).toBe(404);
      expect(ownSubmissionResponse.body.message).toBe('Submission not found');
      expect(repo.findTestInBusiness).not.toHaveBeenCalled();
    });
  });

  describe('create and update are JSON', () => {
    it('creates a draft from a JSON body', async () => {
      repo.insertDraftTest.mockResolvedValue(DRAFT_TEST);
      const createResponse = await request(app).post(BASE).send({
        batchId: 3,
        name: 'Mains Mock 4',
        paperType: 'GS Paper I',
        totalMarks: 250,
        durationMinutes: 180,
        startAt: DRAFT_TEST.startAt.toISOString(),
        deadlineAt: DRAFT_TEST.deadlineAt.toISOString(),
      });
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.data).toEqual(expect.objectContaining({ id: 'st-1', hasQuestionPaper: false }));
    });

    it('returns DTO errors for invalid fields', async () => {
      const createResponse = await request(app).post(BASE).send({ batchId: 3, name: 'x', paperType: 'y', totalMarks: 0 });
      expect(createResponse.status).toBe(400);
      expect(createResponse.body.message).toContain('totalMarks');
    });
  });

  describe('question paper upload (access checked before multer)', () => {
    it('does not write any file when the teacher may not edit the test', async () => {
      mockUserRole = UserRole.TEACHER;
      mockUserId = 999;
      repo.findTestInBusiness.mockResolvedValue(DRAFT_TEST);
      const tempFilesBefore = tempFileCount();

      const uploadResponse = await request(app).put(`${BASE}/st-1/question-paper`).attach('questionPaper', REAL_PDF, PDF_ATTACHMENT);

      expect(uploadResponse.status).toBe(404);
      expect(tempFileCount()).toBe(tempFilesBefore);
      expect(fileStorage.saveUploadThenCommit).not.toHaveBeenCalled();
    });

    it('stores a real PDF for an editable draft and cleans the temp file', async () => {
      repo.findTestInBusiness.mockResolvedValue(DRAFT_TEST);
      repo.updateTest.mockResolvedValue({ ...DRAFT_TEST, questionPaperPath: 'k.pdf' });
      const tempFilesBefore = tempFileCount();

      const uploadResponse = await request(app).put(`${BASE}/st-1/question-paper`).attach('questionPaper', REAL_PDF, PDF_ATTACHMENT);

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.data).toEqual(expect.objectContaining({ hasQuestionPaper: true, questionPaperName: 'GS Paper I.pdf' }));
      expect(uploadResponse.body.data.questionPaperPath).toBeUndefined();
      await waitForTempCleanup();
      expect(tempFileCount()).toBe(tempFilesBefore);
    });

    it.each([
      ['a renamed non-PDF', FAKE_PDF, PDF_ATTACHMENT, 'The uploaded file is not a valid PDF'],
      ['a non-PDF extension', REAL_PDF, { filename: 'paper.docx', contentType: 'application/pdf' }, 'Only PDF files are allowed'],
      [
        'a file over the size limit',
        Buffer.concat([REAL_PDF, Buffer.alloc(SUBJECTIVE_TEST_CONFIG.maxPdfSizeBytes)]),
        PDF_ATTACHMENT,
        `File size cannot exceed ${SUBJECTIVE_TEST_CONFIG.maxPdfSizeMb}MB`,
      ],
    ])('rejects %s', async (_case, fileContent, attachment, expectedMessage) => {
      repo.findTestInBusiness.mockResolvedValue(DRAFT_TEST);
      const uploadResponse = await request(app).put(`${BASE}/st-1/question-paper`).attach('questionPaper', fileContent, attachment);
      expect(uploadResponse.status).toBe(400);
      expect(uploadResponse.body.message).toBe(expectedMessage);
      expect(fileStorage.saveUploadThenCommit).not.toHaveBeenCalled();
    });

    it('requires a file', async () => {
      repo.findTestInBusiness.mockResolvedValue(DRAFT_TEST);
      const uploadResponse = await request(app).put(`${BASE}/st-1/question-paper`).field('note', 'no file');
      expect(uploadResponse.status).toBe(400);
      expect(uploadResponse.body.message).toBe('Upload the question paper');
    });
  });

  describe('grade (access checked before multer)', () => {
    it('validates marks from the data field', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({ ...SUBMITTED_SHEET, test: { ...DRAFT_TEST, status: TestStatus.PUBLISHED } });
      const gradeResponse = await request(app)
        .put(`${BASE}/st-1/submissions/sub-1/grade`)
        .field('data', JSON.stringify({ marksAwarded: -1 }));
      expect(gradeResponse.status).toBe(400);
      expect(gradeResponse.body.message).toContain('marksAwarded');
    });

    it('grades a submitted answer sheet with a checked copy', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({ ...SUBMITTED_SHEET, test: { ...DRAFT_TEST, status: TestStatus.PUBLISHED } });
      repo.saveGrade.mockResolvedValue({ ...SUBMITTED_SHEET, status: SubjectiveSubmissionStatus.CHECKED });

      const gradeResponse = await request(app)
        .put(`${BASE}/st-1/submissions/sub-1/grade`)
        .field('data', JSON.stringify({ marksAwarded: 118, remarks: 'Good structure' }))
        .attach('checkedAnswerSheet', REAL_PDF, PDF_ATTACHMENT);

      expect(gradeResponse.status).toBe(200);
      expect(repo.saveGrade).toHaveBeenCalledWith(
        'sub-1',
        null,
        expect.objectContaining({ marksAwarded: 118, remarks: 'Good structure', checkedBy: 1 }),
      );
    });
  });

  describe('answer sheet submit (access checked before multer)', () => {
    it('does not write any file when the student has not started the test', async () => {
      mockUserRole = UserRole.STUDENT;
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue({ ...DRAFT_TEST, status: TestStatus.PUBLISHED, submissions: [] });
      const tempFilesBefore = tempFileCount();

      const submitResponse = await request(app).post(`${BASE}/st-1/submissions`).attach('answerSheet', REAL_PDF, PDF_ATTACHMENT);

      expect(submitResponse.status).toBe(400);
      expect(submitResponse.body.message).toBe('Start the test before submitting');
      expect(tempFileCount()).toBe(tempFilesBefore);
    });
  });
});
