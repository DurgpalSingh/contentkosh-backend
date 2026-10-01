import { Prisma, UserRole } from '@prisma/client';
import { SubjectiveTestService } from '../../../src/services/subjectiveTest.service';
import { ApiError, BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import {
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
  TestStatus,
} from '../../../src/constants/test-enums';
import * as subjectiveRepo from '../../../src/repositories/subjectiveTest.repo';
import * as userRepo from '../../../src/repositories/user.repo';
import { privateFileService } from '../../../src/services/privateFile.service';
import { hasPdfSignature } from '../../../src/utils/fileSignature.util';

jest.mock('../../../src/repositories/subjectiveTest.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/utils/test.utils');
jest.mock('../../../src/utils/fileSignature.util');
jest.mock('../../../src/services/privateFile.service', () => ({
  ...jest.requireActual('../../../src/services/privateFile.service'),
  privateFileService: {
    buildKey: (...segments: Array<string | number>) => segments.join('/'),
    moveIntoPlace: jest.fn(),
    deleteQuietly: jest.fn(),
    deleteFolderQuietly: jest.fn(),
  },
}));

const repo = subjectiveRepo as jest.Mocked<typeof subjectiveRepo>;
const files = privateFileService as jest.Mocked<typeof privateFileService>;
const mockHasPdfSignature = hasPdfSignature as jest.MockedFunction<typeof hasPdfSignature>;

const HOUR = 3_600_000;
const BUSINESS_ID = 1;
const ADMIN = { id: 1, role: UserRole.ADMIN };
const TEACHER = { id: 7, role: UserRole.TEACHER };
const STUDENT = { id: 42, role: UserRole.STUDENT };
const PAPER_KEY = 'subjective/1/st-1/question-paper-old.pdf';

const buildTest = (overrides: Partial<subjectiveRepo.SubjectiveTestRecord> = {}): subjectiveRepo.SubjectiveTestRecord => ({
  id: 'st-1',
  businessId: BUSINESS_ID,
  batchId: 3,
  batch: { id: 3, displayName: 'Batch A' },
  subjectId: null,
  subject: null,
  name: 'Mains Mock 4',
  paperType: 'GS Paper I',
  description: null,
  instructions: null,
  status: TestStatus.PUBLISHED,
  totalMarks: 250,
  durationMinutes: 180,
  startAt: new Date(Date.now() - HOUR),
  deadlineAt: new Date(Date.now() + 5 * HOUR),
  questionPaperPath: PAPER_KEY,
  createdBy: TEACHER.id,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildSubmission = (
  overrides: Partial<subjectiveRepo.SubjectiveSubmissionRecord> = {},
): subjectiveRepo.SubjectiveSubmissionRecord => ({
  id: 'sub-1',
  subjectiveTestId: 'st-1',
  studentId: STUDENT.id,
  status: SubjectiveSubmissionStatus.IN_PROGRESS,
  startedAt: new Date(Date.now() - 10 * 60_000),
  submittedAt: null,
  answerSheetPath: null,
  marksAwarded: null,
  remarks: null,
  checkedAnswerSheetPath: null,
  checkedBy: null,
  checkedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const uploadedFile = { path: 'private-uploads/tmp/tmp-1.pdf', originalname: 'rahul-gs1-mock3.pdf' } as Express.Multer.File;

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('SubjectiveTestService', () => {
  let service: SubjectiveTestService;

  beforeEach(() => {
    service = new SubjectiveTestService();
    mockHasPdfSignature.mockResolvedValue(true);
  });

  describe('staff access', () => {
    it('hides a test from a teacher who did not create it', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest({ createdBy: 999 }));
      await expect(service.get(BUSINESS_ID, 'st-1', TEACHER)).rejects.toThrow(NotFoundError);
    });

    it('rejects updates once a test is published', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest());
      await expect(service.update(BUSINESS_ID, 'st-1', { name: 'x' }, undefined, ADMIN)).rejects.toThrow(
        'A published test cannot be changed',
      );
    });
  });

  describe('create', () => {
    const dto = {
      batchId: 3,
      name: ' Mock ',
      paperType: 'GS Paper I',
      totalMarks: 250,
      durationMinutes: 180,
      startAt: new Date(Date.now() + HOUR).toISOString(),
      deadlineAt: new Date(Date.now() + 4 * HOUR).toISOString(),
    };

    it('rejects a deadline before the start', async () => {
      await expect(
        service.create(BUSINESS_ID, { ...dto, deadlineAt: dto.startAt }, undefined, ADMIN),
      ).rejects.toThrow('Deadline must be after the start time');
      expect(repo.createSubjectiveTest).not.toHaveBeenCalled();
    });

    it('rejects a non-PDF upload before creating anything', async () => {
      mockHasPdfSignature.mockResolvedValue(false);
      await expect(service.create(BUSINESS_ID, dto, uploadedFile, ADMIN)).rejects.toThrow('not a valid PDF');
      expect(repo.createSubjectiveTest).not.toHaveBeenCalled();
    });

    it('creates a draft and stores the paper under the new test id', async () => {
      repo.createSubjectiveTest.mockResolvedValue(buildTest({ status: TestStatus.DRAFT, questionPaperPath: null }));
      repo.updateSubjectiveTest.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));

      await service.create(BUSINESS_ID, dto, uploadedFile, ADMIN);

      expect(repo.createSubjectiveTest).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mock', status: TestStatus.DRAFT, createdBy: ADMIN.id }),
      );
      const key = files.moveIntoPlace.mock.calls[0]![1];
      expect(key).toMatch(/^subjective\/1\/st-1\/question-paper-.*\.pdf$/);
      expect(repo.updateSubjectiveTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1', { questionPaperPath: key });
    });

    it('removes the new draft and file if saving the paper fails', async () => {
      repo.createSubjectiveTest.mockResolvedValue(buildTest({ status: TestStatus.DRAFT, questionPaperPath: null }));
      repo.updateSubjectiveTest.mockRejectedValue(new Error('db down'));

      await expect(service.create(BUSINESS_ID, dto, uploadedFile, ADMIN)).rejects.toThrow('db down');
      expect(files.deleteQuietly).toHaveBeenCalledWith(files.moveIntoPlace.mock.calls[0]![1]);
      expect(repo.deleteSubjectiveTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1');
    });
  });

  describe('publish', () => {
    it('requires a question paper', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest({ status: TestStatus.DRAFT, questionPaperPath: null }));
      await expect(service.publish(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow('Upload the question paper before publishing');
    });

    it('rejects a deadline that has already passed', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(
        buildTest({
          status: TestStatus.DRAFT,
          startAt: new Date(Date.now() - 3 * HOUR),
          deadlineAt: new Date(Date.now() - HOUR),
        }),
      );
      await expect(service.publish(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow('deadline has already passed');
    });

    it('publishes a valid draft', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      repo.updateSubjectiveTest.mockResolvedValue(buildTest());
      await service.publish(BUSINESS_ID, 'st-1', ADMIN);
      expect(repo.updateSubjectiveTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1', {
        status: TestStatus.PUBLISHED,
        updatedBy: ADMIN.id,
      });
    });
  });

  describe('remove', () => {
    it('blocks deleting a published test', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest());
      await expect(service.remove(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow(BadRequestError);
      expect(repo.deleteSubjectiveTest).not.toHaveBeenCalled();
    });

    it('deletes a draft and its files', async () => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      repo.countSubmissionsForTest.mockResolvedValue(0);
      repo.deleteSubjectiveTest.mockResolvedValue({ count: 1 });
      await service.remove(BUSINESS_ID, 'st-1', ADMIN);
      expect(files.deleteFolderQuietly).toHaveBeenCalledWith('subjective/1/st-1');
    });
  });

  describe('start', () => {
    beforeEach(() => repo.findSubmissionByTestAndStudent.mockResolvedValue(null));

    it('rejects before the window opens', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(
        buildTest({ startAt: new Date(Date.now() + HOUR), deadlineAt: new Date(Date.now() + 4 * HOUR) }),
      );
      await expect(service.start(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('has not started yet');
    });

    it('rejects after the deadline', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(
        buildTest({ startAt: new Date(Date.now() - 4 * HOUR), deadlineAt: new Date(Date.now() - HOUR) }),
      );
      await expect(service.start(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('deadline for this test has passed');
    });

    it('returns 404 when the student is not an active batch member', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(null);
      await expect(service.start(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('creates the attempt when open', async () => {
      const test = buildTest();
      const created = buildSubmission();
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(test);
      repo.createSubmission.mockResolvedValue(created);

      const result = await service.start(BUSINESS_ID, 'st-1', STUDENT);

      expect(result).toEqual({
        submissionId: created.id,
        displayStatus: SubjectiveDisplayStatus.IN_PROGRESS,
        startedAt: created.startedAt,
        effectiveDeadlineAt: new Date(created.startedAt.getTime() + 180 * 60_000),
      });
    });

    it('resumes an in-progress attempt', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValue(buildSubmission());
      const result = await service.start(BUSINESS_ID, 'st-1', STUDENT);
      expect(result.submissionId).toBe('sub-1');
      expect(repo.createSubmission).not.toHaveBeenCalled();
    });

    it('resumes the row created by a concurrent start', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValueOnce(null).mockResolvedValueOnce(buildSubmission());
      repo.createSubmission.mockRejectedValue(uniqueViolation());
      const result = await service.start(BUSINESS_ID, 'st-1', STUDENT);
      expect(result.submissionId).toBe('sub-1');
    });

    it('rejects an expired attempt', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest({ durationMinutes: 5 }));
      repo.findSubmissionByTestAndStudent.mockResolvedValue(buildSubmission());
      await expect(service.start(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('Your time for this test is over');
    });

    it('rejects an already submitted attempt', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValue(
        buildSubmission({ status: SubjectiveSubmissionStatus.SUBMITTED }),
      );
      await expect(service.start(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('already submitted');
    });
  });

  describe('question paper for students', () => {
    it('requires the student to have started', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValue(null);
      await expect(service.getQuestionPaperForStudent(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow(
        'Start the test to view the question paper',
      );
    });

    it('returns the paper once started', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValue(buildSubmission());
      const ref = await service.getQuestionPaperForStudent(BUSINESS_ID, 'st-1', STUDENT);
      expect(ref.key).toBe(PAPER_KEY);
    });
  });

  describe('submit', () => {
    beforeEach(() => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest());
      repo.findSubmissionByTestAndStudent.mockResolvedValue(buildSubmission());
    });

    it('requires a file', async () => {
      await expect(service.submit(BUSINESS_ID, 'st-1', undefined, STUDENT)).rejects.toThrow('Upload your answer sheet');
    });

    it('rejects a file that is not a real PDF', async () => {
      mockHasPdfSignature.mockResolvedValue(false);
      await expect(service.submit(BUSINESS_ID, 'st-1', uploadedFile, STUDENT)).rejects.toThrow('not a valid PDF');
      expect(files.moveIntoPlace).not.toHaveBeenCalled();
    });

    it('rejects after the effective end time', async () => {
      repo.findPublishedSubjectiveTestForStudent.mockResolvedValue(buildTest({ durationMinutes: 5 }));
      await expect(service.submit(BUSINESS_ID, 'st-1', uploadedFile, STUDENT)).rejects.toThrow('time for this test is over');
      expect(files.moveIntoPlace).not.toHaveBeenCalled();
    });

    it('cleans up the file when a concurrent submit already won', async () => {
      repo.markSubmissionSubmitted.mockResolvedValue(0);
      await expect(service.submit(BUSINESS_ID, 'st-1', uploadedFile, STUDENT)).rejects.toThrow('already submitted');
      expect(files.deleteQuietly).toHaveBeenCalledWith(files.moveIntoPlace.mock.calls[0]![1]);
    });

    it('stores the answer sheet and marks the attempt submitted', async () => {
      repo.markSubmissionSubmitted.mockResolvedValue(1);
      const result = await service.submit(BUSINESS_ID, 'st-1', uploadedFile, STUDENT);
      const key = files.moveIntoPlace.mock.calls[0]![1];
      expect(key).toMatch(/^subjective\/1\/st-1\/answers\/42-\d+-\d+__rahul-gs1-mock3\.pdf$/);
      expect(repo.markSubmissionSubmitted).toHaveBeenCalledWith('sub-1', { answerSheetPath: key, submittedAt: result.submittedAt });
      expect(result.displayStatus).toBe(SubjectiveDisplayStatus.SUBMITTED);
    });
  });

  describe('grade', () => {
    const submitted = buildSubmission({ status: SubjectiveSubmissionStatus.SUBMITTED, answerSheetPath: 'a.pdf' });
    const checked = buildSubmission({
      status: SubjectiveSubmissionStatus.CHECKED,
      answerSheetPath: 'a.pdf',
      checkedAnswerSheetPath: 'old-checked.pdf',
    });

    beforeEach(() => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest());
      (userRepo.findBasicProfileById as jest.Mock).mockResolvedValue({ id: STUDENT.id, name: 'S', email: 's@x.com' });
    });

    it('rejects grading an in-progress attempt', async () => {
      repo.findSubmissionForTest.mockResolvedValue(buildSubmission());
      await expect(service.grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 10 }, uploadedFile, ADMIN)).rejects.toThrow(
        'Only submitted answer sheets can be graded',
      );
    });

    it('rejects marks above the total', async () => {
      repo.findSubmissionForTest.mockResolvedValue(submitted);
      await expect(service.grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 251 }, uploadedFile, ADMIN)).rejects.toThrow(
        'Marks cannot be more than 250',
      );
    });

    it('requires the checked PDF on the first grade', async () => {
      repo.findSubmissionForTest.mockResolvedValue(submitted);
      await expect(service.grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 100 }, undefined, ADMIN)).rejects.toThrow(
        'Upload the checked answer sheet',
      );
    });

    it('allows changing marks without re-uploading', async () => {
      repo.findSubmissionForTest.mockResolvedValue(checked);
      repo.updateSubmissionGrade.mockResolvedValue(1);
      await service.grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 120, remarks: ' Good ' }, undefined, ADMIN);
      expect(repo.updateSubmissionGrade).toHaveBeenCalledWith(
        'sub-1',
        'old-checked.pdf',
        expect.objectContaining({ marksAwarded: 120, remarks: 'Good', checkedAnswerSheetPath: 'old-checked.pdf', checkedBy: ADMIN.id }),
      );
      expect(files.deleteQuietly).not.toHaveBeenCalled();
    });

    it('replaces the checked copy and removes the old one after saving', async () => {
      repo.findSubmissionForTest.mockResolvedValue(checked);
      repo.updateSubmissionGrade.mockResolvedValue(1);
      await service.grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 120 }, uploadedFile, ADMIN);
      const newKey = files.moveIntoPlace.mock.calls[0]![1];
      expect(newKey).toMatch(/^subjective\/1\/st-1\/checked\/sub-1-.*\.pdf$/);
      expect(files.deleteQuietly).toHaveBeenCalledWith('old-checked.pdf');
      expect(files.deleteQuietly).not.toHaveBeenCalledWith(newKey);
    });

    it('returns 409 and keeps the old file when someone else graded first', async () => {
      repo.findSubmissionForTest.mockResolvedValue(checked);
      repo.updateSubmissionGrade.mockResolvedValue(0);
      const error = await service
        .grade(BUSINESS_ID, 'st-1', 'sub-1', { marksAwarded: 120 }, uploadedFile, ADMIN)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(409);
      expect(files.deleteQuietly).toHaveBeenCalledWith(files.moveIntoPlace.mock.calls[0]![1]);
      expect(files.deleteQuietly).not.toHaveBeenCalledWith('old-checked.pdf');
    });
  });

  describe('student result visibility', () => {
    it('hides marks until the submission is checked', async () => {
      repo.findStudentSubmissionWithTest.mockResolvedValue({
        ...buildSubmission({ status: SubjectiveSubmissionStatus.SUBMITTED, marksAwarded: 99, answerSheetPath: 'a.pdf' }),
        test: buildTest(),
      });
      const detail = await service.getOwnSubmissionDetail(BUSINESS_ID, 'sub-1', STUDENT);
      expect(detail.result).toBeNull();
      await expect(service.getOwnCheckedAnswerSheet(BUSINESS_ID, 'sub-1', STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('shows marks, remarks and the checked copy once checked', async () => {
      repo.findStudentSubmissionWithTest.mockResolvedValue({
        ...buildSubmission({
          status: SubjectiveSubmissionStatus.CHECKED,
          answerSheetPath: 'a.pdf',
          marksAwarded: 118,
          remarks: 'Good',
          checkedAnswerSheetPath: 'c.pdf',
        }),
        test: buildTest(),
      });
      const detail = await service.getOwnSubmissionDetail(BUSINESS_ID, 'sub-1', STUDENT);
      expect(detail.result).toEqual(expect.objectContaining({ marksAwarded: 118, totalMarks: 250, remarks: 'Good', hasCheckedAnswerSheet: true }));
      expect((await service.getOwnCheckedAnswerSheet(BUSINESS_ID, 'sub-1', STUDENT)).key).toBe('c.pdf');
    });

    it("returns 404 for another student's submission", async () => {
      repo.findStudentSubmissionWithTest.mockResolvedValue(null);
      await expect(service.getOwnSubmissionDetail(BUSINESS_ID, 'sub-other', STUDENT)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listSubmissions', () => {
    const rosterRow = (studentId: number, name: string, status: number | null): subjectiveRepo.SubjectiveRosterRow => ({
      studentId,
      studentName: name,
      studentEmail: `${name.toLowerCase()}@x.com`,
      submissionId: status === null ? null : `sub-${studentId}`,
      status,
      startedAt: status === null ? null : new Date(Date.now() - 10 * 60_000),
      submittedAt: null,
      marksAwarded: null,
      remarks: null,
      answerSheetPath: null,
      hasCheckedAnswerSheet: false,
      checkedAt: null,
    });

    beforeEach(() => {
      repo.findSubjectiveTestById.mockResolvedValue(buildTest());
      repo.findSubmissionRoster.mockResolvedValue([
        rosterRow(1, 'Asha', null),
        rosterRow(2, 'Bala', SubjectiveSubmissionStatus.SUBMITTED),
        rosterRow(3, 'Chitra', SubjectiveSubmissionStatus.CHECKED),
        rosterRow(4, 'Dev', null),
      ]);
    });

    it('includes students who never started', async () => {
      const result = await service.listSubmissions(BUSINESS_ID, 'st-1', { status: SubjectiveDisplayStatus.NOT_STARTED }, ADMIN);
      expect(result.items.map((r) => r.studentName)).toEqual(['Asha', 'Dev']);
      expect(result.total).toBe(2);
    });

    it('searches by name or email and pages the result', async () => {
      const searched = await service.listSubmissions(BUSINESS_ID, 'st-1', { search: 'CHITRA@' }, ADMIN);
      expect(searched.items.map((r) => r.studentId)).toEqual([3]);

      const paged = await service.listSubmissions(BUSINESS_ID, 'st-1', { page: 2, limit: 3 }, ADMIN);
      expect(paged.items.map((r) => r.studentId)).toEqual([4]);
      expect(paged.total).toBe(4);
    });

    it('counts each display status on the detail view', async () => {
      const { submissionCounts } = await service.get(BUSINESS_ID, 'st-1', ADMIN);
      expect(submissionCounts).toEqual({ NOT_STARTED: 2, IN_PROGRESS: 0, SUBMITTED: 1, CHECKED: 1, EXPIRED: 0 });
    });
  });
});
