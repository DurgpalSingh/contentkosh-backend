/**
 * subjectiveTest.routes.test.ts
 * Route-level tests: role guards, static-before-param route order, multipart parsing,
 * PDF validation (extension, mimetype, signature) and temp-file cleanup.
 * Repos and the final file move are mocked; multer writes real temp files.
 */

import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import express from 'express';
import { UserRole } from '@prisma/client';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { subjectiveTestRouter } from '../../../src/routes/subjectiveTest.routes';
import { SUBJECTIVE_TEST_CONFIG } from '../../../src/config/subjectiveTest.config';
import { SubjectiveSubmissionStatus, TestStatus } from '../../../src/constants/test-enums';
import * as subjectiveRepo from '../../../src/repositories/subjectiveTest.repo';
import * as batchRepo from '../../../src/repositories/batch.repo';

jest.mock('../../../src/repositories/subjectiveTest.repo');
jest.mock('../../../src/repositories/batch.repo');
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/services/privateFile.service', () => ({
  privateFileService: {
    buildKey: (...segments: Array<string | number>) => segments.join('/'),
    moveIntoPlace: jest.fn(),
    deleteQuietly: jest.fn(),
    deleteFolderQuietly: jest.fn(),
    streamFile: jest.fn(),
  },
}));

let mockUserRole: UserRole = UserRole.ADMIN;

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
  req.user = { id: 1, role: mockUserRole, businessId: 1, email: 'test@test.com' };
  next();
});
app.use('/api/business', subjectiveTestRouter);
app.use(errorHandler);

const repo = subjectiveRepo as jest.Mocked<typeof subjectiveRepo>;
const HOUR = 3_600_000;
const BASE = '/api/business/1/subjective-tests';
const TEMP_DIR = path.join(SUBJECTIVE_TEST_CONFIG.privateRootDir, SUBJECTIVE_TEST_CONFIG.tempSubDir);
const REAL_PDF = Buffer.from('%PDF-1.4\n%fake but valid header\n');
const FAKE_PDF = Buffer.from('MZ this is not a pdf');

const TEST_ROW: subjectiveRepo.SubjectiveTestRecord = {
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

const CREATE_DATA = {
  batchId: 3,
  name: 'Mains Mock 4',
  paperType: 'GS Paper I',
  totalMarks: 250,
  durationMinutes: 180,
  startAt: TEST_ROW.startAt.toISOString(),
  deadlineAt: TEST_ROW.deadlineAt.toISOString(),
};

const tempFileCount = () => (fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR).length : 0);
/** Temp cleanup runs on response 'finish'; give the fs.rm a tick to complete. */
const flushCleanup = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Subjective test routes', () => {
  beforeEach(() => {
    mockUserRole = UserRole.ADMIN;
    (batchRepo.findBatchBusinessId as jest.Mock).mockResolvedValue(1);
  });

  describe('role guards', () => {
    it('blocks students from staff routes', async () => {
      mockUserRole = UserRole.STUDENT;
      const res = await request(app).get(BASE);
      expect(res.status).toBe(403);
    });

    it('blocks staff from starting a test', async () => {
      const res = await request(app).post(`${BASE}/st-1/start`).send({});
      expect(res.status).toBe(403);
    });

    it('lets both staff and students reach the question paper route', async () => {
      mockUserRole = UserRole.STUDENT;
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue({ ...TEST_ROW, status: TestStatus.PUBLISHED });
      repo.findSubmissionByTestAndStudent.mockResolvedValue(null);
      const res = await request(app).get(`${BASE}/st-1/question-paper`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Start the test to view the question paper');
    });
  });

  describe('route order', () => {
    it('routes /available to the student catalog, not the :id route', async () => {
      mockUserRole = UserRole.STUDENT;
      repo.findPublishedSubjectiveTestsForStudent.mockResolvedValue([]);
      repo.findSubmissionsForStudent.mockResolvedValue([]);
      const res = await request(app).get(`${BASE}/available`);
      expect(res.status).toBe(200);
      expect(repo.findSubjectiveTestById).not.toHaveBeenCalled();
    });

    it('routes /submissions/:id to the student own-submission route', async () => {
      mockUserRole = UserRole.STUDENT;
      repo.findStudentSubmissionWithTest.mockResolvedValue(null);
      const res = await request(app).get(`${BASE}/submissions/sub-1`);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Submission not found');
    });
  });

  describe('create (multipart)', () => {
    it('parses the data field, accepts a real PDF and cleans the temp file', async () => {
      repo.createSubjectiveTest.mockResolvedValue(TEST_ROW);
      repo.updateSubjectiveTest.mockResolvedValue({ ...TEST_ROW, questionPaperPath: 'k.pdf' });
      const before = tempFileCount();

      const res = await request(app)
        .post(BASE)
        .field('data', JSON.stringify(CREATE_DATA))
        .attach('questionPaper', REAL_PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(expect.objectContaining({ id: 'st-1', hasQuestionPaper: true }));
      expect(res.body.data.questionPaperPath).toBeUndefined();
      await flushCleanup();
      expect(tempFileCount()).toBe(before);
    });

    it('rejects a renamed non-PDF by its signature', async () => {
      const res = await request(app)
        .post(BASE)
        .field('data', JSON.stringify(CREATE_DATA))
        .attach('questionPaper', FAKE_PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('The uploaded file is not a valid PDF');
      expect(repo.createSubjectiveTest).not.toHaveBeenCalled();
    });

    it('rejects a non-PDF extension before saving', async () => {
      const res = await request(app)
        .post(BASE)
        .field('data', JSON.stringify(CREATE_DATA))
        .attach('questionPaper', REAL_PDF, { filename: 'paper.docx', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Only PDF files are allowed');
    });

    it('rejects files over the configured size limit', async () => {
      const tooBig = Buffer.concat([REAL_PDF, Buffer.alloc(SUBJECTIVE_TEST_CONFIG.maxPdfSizeBytes)]);
      const res = await request(app)
        .post(BASE)
        .field('data', JSON.stringify(CREATE_DATA))
        .attach('questionPaper', tooBig, { filename: 'paper.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(`File size cannot exceed ${SUBJECTIVE_TEST_CONFIG.maxPdfSizeMb}MB`);
    });

    it('returns DTO errors and still removes the temp file', async () => {
      const before = tempFileCount();
      const res = await request(app)
        .post(BASE)
        .field('data', JSON.stringify({ ...CREATE_DATA, totalMarks: 0 }))
        .attach('questionPaper', REAL_PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('totalMarks');
      await flushCleanup();
      expect(tempFileCount()).toBe(before);
    });

    it('rejects malformed data JSON', async () => {
      const res = await request(app).post(BASE).field('data', '{not json');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid JSON data in multipart request');
    });
  });

  describe('grade (multipart)', () => {
    it('validates marks from the data field', async () => {
      const res = await request(app)
        .put(`${BASE}/st-1/submissions/sub-1/grade`)
        .field('data', JSON.stringify({ marksAwarded: -1 }));
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('marksAwarded');
    });

    it('grades a submitted answer sheet', async () => {
      repo.findSubjectiveTestById.mockResolvedValue({ ...TEST_ROW, status: TestStatus.PUBLISHED });
      repo.findSubmissionForTest.mockResolvedValue({
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
      });
      repo.updateSubmissionGrade.mockResolvedValue(1);

      const res = await request(app)
        .put(`${BASE}/st-1/submissions/sub-1/grade`)
        .field('data', JSON.stringify({ marksAwarded: 118, remarks: 'Good structure' }))
        .attach('checkedAnswerSheet', REAL_PDF, { filename: 'checked.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(repo.updateSubmissionGrade).toHaveBeenCalledWith(
        'sub-1',
        null,
        expect.objectContaining({ marksAwarded: 118, remarks: 'Good structure', checkedBy: 1 }),
      );
    });
  });
});
