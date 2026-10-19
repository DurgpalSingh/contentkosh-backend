import { UserRole } from '@prisma/client';
import { SubjectiveTestService } from '../../../src/services/subjectiveTest.service';
import { STUDENT_ATTEMPT_REQUIREMENT } from '../../../src/constants/subjectiveTest.constants';
import type {
  SubjectiveStaffSubmissionResponse,
  SubjectiveStudentSubmissionResponse,
} from '../../../src/mappers/subjectiveTest.mapper';
import { ApiError, BadRequestError, NotFoundError } from '../../../src/errors/api.errors';
import { SubjectiveDisplayStatus, SubjectiveSubmissionFile, SubjectiveSubmissionStatus, TestStatus } from '../../../src/constants/test-enums';
import * as subjectiveTestRepo from '../../../src/repositories/subjectiveTest.repo';
import * as userRepo from '../../../src/repositories/user.repo';
import * as testUtils from '../../../src/utils/test.utils';
import { uploadsFileStorage } from '../../../src/services/fileStorage.service';

jest.mock('../../../src/repositories/subjectiveTest.repo');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/utils/test.utils');
jest.mock('../../../src/services/fileStorage.service', () => ({
  ...jest.requireActual('../../../src/services/fileStorage.service'),
  uploadsFileStorage: {
    joinStorageKey: (...keyParts: Array<string | number>) => keyParts.join('/'),
    saveUploadThenCommit: jest.fn(),
    deleteFolderIfExists: jest.fn(),
  },
}));

const repo = subjectiveTestRepo as jest.Mocked<typeof subjectiveTestRepo>;
const fileStorage = uploadsFileStorage as jest.Mocked<typeof uploadsFileStorage>;

const HOUR = 3_600_000;
const BUSINESS_ID = 1;
const ADMIN = { id: 1, role: UserRole.ADMIN };
const TEACHER = { id: 7, role: UserRole.TEACHER };
const STUDENT = { id: 42, role: UserRole.STUDENT };
const QUESTION_PAPER_PATH = 'subjective/1/st-1/question-paper-old.pdf';

const buildTest = (overrides: Partial<subjectiveTestRepo.SubjectiveTestRecord> = {}): subjectiveTestRepo.SubjectiveTestRecord => ({
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
  questionPaperPath: QUESTION_PAPER_PATH,
  createdBy: TEACHER.id,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildAttempt = (
  overrides: Partial<subjectiveTestRepo.SubjectiveSubmissionRecord> = {},
): subjectiveTestRepo.SubjectiveSubmissionRecord => ({
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

const testWithOwnAttempt = (
  testOverrides: Partial<subjectiveTestRepo.SubjectiveTestRecord> = {},
  ownAttempt: subjectiveTestRepo.SubjectiveSubmissionRecord | null = null,
) => ({ ...buildTest(testOverrides), submissions: ownAttempt ? [ownAttempt] : [] });

const uploadedPdf = { path: 'uploads/tmp/tmp-1.pdf', originalname: 'rahul-gs1-mock3.pdf' } as Express.Multer.File;
const prismaError = (code: string) => Object.assign(new Error(code), { code });

describe('SubjectiveTestService', () => {
  let service: SubjectiveTestService;

  beforeEach(() => {
    service = new SubjectiveTestService();
    fileStorage.saveUploadThenCommit.mockImplementation(async ({ commitToDatabase }) => commitToDatabase());
  });

  describe('staff access', () => {
    it('hides a test from a teacher who did not create it', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ createdBy: 999 }));
      await expect(service.findTestForStaff(BUSINESS_ID, 'st-1', TEACHER)).rejects.toThrow(NotFoundError);
    });

    it('refuses to change a published test', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest());
      await expect(service.updateDraftTest(BUSINESS_ID, 'st-1', { name: 'x' }, ADMIN)).rejects.toThrow(
        'A published test cannot be changed',
      );
    });
  });

  describe('createDraftTest', () => {
    const createDto = {
      batchId: 3,
      subjectId: 8,
      name: 'Mock',
      paperType: 'GS Paper I',
      totalMarks: 250,
      durationMinutes: 180,
      startAt: new Date(Date.now() + HOUR).toISOString(),
      deadlineAt: new Date(Date.now() + 4 * HOUR).toISOString(),
    };

    it('rejects a deadline before the start without touching the database', async () => {
      await expect(service.createDraftTest(BUSINESS_ID, { ...createDto, deadlineAt: createDto.startAt }, ADMIN)).rejects.toThrow(
        'Deadline must be after the start time',
      );
      expect(testUtils.assertBatchBelongsToBusiness).not.toHaveBeenCalled();
      expect(repo.insertDraftTest).not.toHaveBeenCalled();
    });

    it('checks batch, teacher access and subject, then inserts the draft', async () => {
      repo.insertDraftTest.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      await service.createDraftTest(BUSINESS_ID, createDto, ADMIN);

      expect(testUtils.assertBatchBelongsToBusiness).toHaveBeenCalledWith(BUSINESS_ID, 3);
      expect(testUtils.assertSubjectForBatch).toHaveBeenCalledWith(expect.objectContaining({ batchId: 3, subjectId: 8 }));
      expect(repo.insertDraftTest).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mock', status: TestStatus.DRAFT, createdBy: ADMIN.id }),
      );
    });
  });

  describe('updateDraftTest', () => {
    it('saves only known fields, so an extra `status` in the body cannot publish the test', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      repo.updateTest.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));

      await service.updateDraftTest(BUSINESS_ID, 'st-1', { name: 'New name', status: TestStatus.PUBLISHED } as never, ADMIN);

      const savedFields = repo.updateTest.mock.calls[0]![2];
      expect(savedFields).toEqual(expect.objectContaining({ name: 'New name', updatedBy: ADMIN.id }));
      expect(savedFields).not.toHaveProperty('status');
    });
  });

  describe('replaceQuestionPaper', () => {
    it('saves the new paper and replaces the old one', async () => {
      const draftTest = buildTest({ status: TestStatus.DRAFT });
      repo.updateTest.mockResolvedValue(draftTest);

      await service.replaceQuestionPaper(draftTest, uploadedPdf, ADMIN);

      const { storageKey, replacedStorageKey } = fileStorage.saveUploadThenCommit.mock.calls[0]![0];
      expect(storageKey).toMatch(/^subjective\/1\/st-1\/question-paper-\d+-\d+\.pdf$/);
      expect(replacedStorageKey).toBe(QUESTION_PAPER_PATH);
      expect(repo.updateTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1', { questionPaperPath: storageKey, updatedBy: ADMIN.id });
    });
  });

  describe('publishDraftTest', () => {
    it('requires a question paper', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ status: TestStatus.DRAFT, questionPaperPath: null }));
      await expect(service.publishDraftTest(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow('Upload the question paper before publishing');
    });

    it('rejects a deadline that has already passed', async () => {
      repo.findTestInBusiness.mockResolvedValue(
        buildTest({ status: TestStatus.DRAFT, startAt: new Date(Date.now() - 3 * HOUR), deadlineAt: new Date(Date.now() - HOUR) }),
      );
      await expect(service.publishDraftTest(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow('deadline has already passed');
    });

    it('publishes a valid draft', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      repo.updateTest.mockResolvedValue(buildTest());
      await service.publishDraftTest(BUSINESS_ID, 'st-1', ADMIN);
      expect(repo.updateTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1', { status: TestStatus.PUBLISHED, updatedBy: ADMIN.id });
    });
  });

  describe('deleteDraftTest', () => {
    it('blocks deleting a published test', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest());
      await expect(service.deleteDraftTest(BUSINESS_ID, 'st-1', ADMIN)).rejects.toThrow(BadRequestError);
      expect(repo.deleteTest).not.toHaveBeenCalled();
    });

    it('deletes a draft and its files', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ status: TestStatus.DRAFT }));
      await service.deleteDraftTest(BUSINESS_ID, 'st-1', ADMIN);
      expect(repo.deleteTest).toHaveBeenCalledWith(BUSINESS_ID, 'st-1');
      expect(fileStorage.deleteFolderIfExists).toHaveBeenCalledWith('subjective/1/st-1');
    });
  });

  describe('getTestDetailForStaff', () => {
    const SUBMISSION_COUNTS = { NOT_STARTED: 2, IN_PROGRESS: 0, SUBMITTED: 1, CHECKED: 1, EXPIRED: 1 };

    it('returns the test and its counts from a single repo call', async () => {
      repo.findTestWithSubmissionCounts.mockResolvedValue({ subjectiveTest: buildTest(), submissionCounts: SUBMISSION_COUNTS });

      const testDetail = await service.getTestDetailForStaff(BUSINESS_ID, 'st-1', ADMIN);

      expect(testDetail.submissionCounts).toEqual(SUBMISSION_COUNTS);
      expect(repo.findTestWithSubmissionCounts).toHaveBeenCalledTimes(1);
      expect(repo.findTestInBusiness).not.toHaveBeenCalled();
    });

    it('hides the counts of a test the teacher did not create', async () => {
      repo.findTestWithSubmissionCounts.mockResolvedValue({
        subjectiveTest: buildTest({ createdBy: 999 }),
        submissionCounts: SUBMISSION_COUNTS,
      });
      await expect(service.getTestDetailForStaff(BUSINESS_ID, 'st-1', TEACHER)).rejects.toThrow(NotFoundError);
    });
  });

  describe('listRosterForStaff', () => {
    const rosterEntry = (
      studentId: number,
      studentName: string,
      displayStatus: SubjectiveDisplayStatus,
    ): subjectiveTestRepo.RosterEntryRecord => ({
      studentId,
      studentName,
      studentEmail: `${studentName.toLowerCase()}@x.com`,
      submissionId: displayStatus === SubjectiveDisplayStatus.NOT_STARTED ? null : `sub-${studentId}`,
      displayStatus,
      startedAt: null,
      submittedAt: null,
      marksAwarded: null,
      remarks: null,
      answerSheetPath: `subjective/1/st-1/answers/${studentId}-1-1__sheet.pdf`,
      hasCheckedAnswerSheet: false,
      checkedAt: null,
    });

    it('passes the filters to the paged SQL query and maps the page', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest());
      repo.findRosterPage.mockResolvedValue({
        rosterEntries: [rosterEntry(1, 'Asha', SubjectiveDisplayStatus.NOT_STARTED)],
        totalMatching: 4,
      });
      const filters = { displayStatus: SubjectiveDisplayStatus.NOT_STARTED, searchText: 'asha', page: 2, pageSize: 3 };

      const rosterPage = await service.listRosterForStaff(BUSINESS_ID, 'st-1', filters, ADMIN);

      expect(repo.findRosterPage).toHaveBeenCalledWith(BUSINESS_ID, 'st-1', filters, expect.any(Date));
      expect(rosterPage).toEqual({
        items: [expect.objectContaining({ studentId: 1, displayStatus: SubjectiveDisplayStatus.NOT_STARTED, answerSheetName: 'sheet.pdf' })],
        total: 4,
        page: 2,
        limit: 3,
      });
      expect(rosterPage.items[0]).not.toHaveProperty('answerSheetPath');
    });

    it('refuses a teacher who did not create the test', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest({ createdBy: 999 }));
      repo.findRosterPage.mockResolvedValue({ rosterEntries: [], totalMatching: 0 });
      await expect(
        service.listRosterForStaff(BUSINESS_ID, 'st-1', { page: 1, pageSize: 20 }, TEACHER),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getQuestionPaperDownload', () => {
    it('lets staff download any time', async () => {
      repo.findTestInBusiness.mockResolvedValue(buildTest());
      const download = await service.getQuestionPaperDownload(BUSINESS_ID, 'st-1', ADMIN);
      expect(download).toEqual({ storageKey: QUESTION_PAPER_PATH, downloadFileName: 'GS Paper I.pdf', contentType: 'application/pdf' });
    });

    it('requires a student to have started the test', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      await expect(service.getQuestionPaperDownload(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow(
        'Start the test to view the question paper',
      );

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt({}, buildAttempt()));
      expect((await service.getQuestionPaperDownload(BUSINESS_ID, 'st-1', STUDENT)).storageKey).toBe(QUESTION_PAPER_PATH);
    });
  });

  describe('startOrResumeAttempt', () => {
    it('rejects before the window opens and after it closes', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(
        testWithOwnAttempt({ startAt: new Date(Date.now() + HOUR), deadlineAt: new Date(Date.now() + 4 * HOUR) }),
      );
      await expect(service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('has not started yet');

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(
        testWithOwnAttempt({ startAt: new Date(Date.now() - 4 * HOUR), deadlineAt: new Date(Date.now() - HOUR) }),
      );
      await expect(service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('deadline for this test has passed');
    });

    it('returns 404 when the student is not enrolled in the batch', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(null);
      await expect(service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('creates the attempt when the window is open', async () => {
      const createdAttempt = buildAttempt();
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      repo.insertInProgressAttempt.mockResolvedValue(createdAttempt);

      const startedAttempt = await service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT);
      expect(startedAttempt).toEqual({
        submissionId: createdAttempt.id,
        displayStatus: SubjectiveDisplayStatus.IN_PROGRESS,
        startedAt: createdAttempt.startedAt,
        effectiveDeadlineAt: new Date(createdAttempt.startedAt.getTime() + 180 * 60_000),
      });
    });

    it('resumes an existing attempt without inserting', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt({}, buildAttempt()));
      expect((await service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).submissionId).toBe('sub-1');
      expect(repo.insertInProgressAttempt).not.toHaveBeenCalled();
    });

    it('resumes the attempt created by a concurrent start (double click)', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      repo.insertInProgressAttempt.mockRejectedValue(prismaError('P2002'));
      repo.findAttemptByTestAndStudent.mockResolvedValue(buildAttempt());
      expect((await service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).submissionId).toBe('sub-1');
    });

    it('rejects an expired or already submitted attempt', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt({ durationMinutes: 5 }, buildAttempt()));
      await expect(service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('Your time for this test is over');

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(
        testWithOwnAttempt({}, buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED })),
      );
      await expect(service.startOrResumeAttempt(BUSINESS_ID, 'st-1', STUDENT)).rejects.toThrow('already submitted');
    });
  });

  describe('findPublishedTestForStudent (one lookup, three attempt requirements)', () => {
    const { NONE, STARTED, OPEN } = STUDENT_ATTEMPT_REQUIREMENT;

    it('NONE: returns the test without an attempt (start)', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      expect((await service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, NONE)).ownAttempt).toBeNull();
    });

    it('STARTED: needs an attempt, even a finished one (question paper)', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      await expect(service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, STARTED)).rejects.toThrow(
        'Start the test to view the question paper',
      );

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(
        testWithOwnAttempt({}, buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED })),
      );
      expect((await service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, STARTED)).ownAttempt.id).toBe('sub-1');
    });

    it('OPEN: needs a started, still-open attempt (submit, runs before the upload)', async () => {
      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt());
      await expect(service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, OPEN)).rejects.toThrow(
        'Start the test before submitting',
      );

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt({ durationMinutes: 5 }, buildAttempt()));
      await expect(service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, OPEN)).rejects.toThrow(
        'time for this test is over',
      );

      repo.findPublishedTestWithOwnAttempt.mockResolvedValue(testWithOwnAttempt({}, buildAttempt()));
      expect((await service.findPublishedTestForStudent(BUSINESS_ID, 'st-1', STUDENT, OPEN)).ownAttempt.id).toBe('sub-1');
    });
  });

  describe('submitAnswerSheet', () => {
    const openAttempt = () => ({ subjectiveTest: buildTest(), ownAttempt: buildAttempt() });

    it("stores the sheet under a key with the student's file name and marks it submitted", async () => {
      repo.markAttemptSubmitted.mockResolvedValue(buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED }));
      const submittedAttempt = await service.submitAnswerSheet(openAttempt(), uploadedPdf, STUDENT);

      const { storageKey } = fileStorage.saveUploadThenCommit.mock.calls[0]![0];
      expect(storageKey).toMatch(/^subjective\/1\/st-1\/answers\/42-\d+-\d+__rahul-gs1-mock3\.pdf$/);
      expect(repo.markAttemptSubmitted).toHaveBeenCalledWith('sub-1', storageKey, submittedAttempt.submittedAt);
      expect(submittedAttempt.displayStatus).toBe(SubjectiveDisplayStatus.SUBMITTED);
    });

    it('reports a concurrent second submit as already submitted', async () => {
      repo.markAttemptSubmitted.mockRejectedValue(prismaError('P2025'));
      await expect(service.submitAnswerSheet(openAttempt(), uploadedPdf, STUDENT)).rejects.toThrow('already submitted');
    });
  });

  describe('grading', () => {
    const submittedSheet = buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED, answerSheetPath: 'a.pdf' });
    const checkedSheet = buildAttempt({
      status: SubjectiveSubmissionStatus.CHECKED,
      answerSheetPath: 'a.pdf',
      checkedAnswerSheetPath: 'old-checked.pdf',
    });

    beforeEach(() => {
      (userRepo.findBasicProfileById as jest.Mock).mockResolvedValue({ id: STUDENT.id, name: 'S', email: 's@x.com' });
      repo.saveGrade.mockResolvedValue(checkedSheet);
    });

    it('refuses to grade an attempt that is still in progress (checked before the upload)', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({ ...buildAttempt(), test: buildTest() });
      await expect(
        service.findSubmission(BUSINESS_ID, 'sub-1', ADMIN, { submittedOnly: true }),
      ).rejects.toThrow('Only submitted answer sheets can be graded');
      expect(repo.findSubmissionWithTest).toHaveBeenCalledWith(BUSINESS_ID, 'sub-1', null);
    });

    it('rejects marks above the total and a first grade without a checked copy', async () => {
      const gradable = { subjectiveTest: buildTest(), submission: submittedSheet };
      await expect(service.gradeSubmission(gradable, { marksAwarded: 251 }, uploadedPdf, ADMIN)).rejects.toThrow(
        'Marks cannot be more than 250',
      );
      await expect(service.gradeSubmission(gradable, { marksAwarded: 100 }, undefined, ADMIN)).rejects.toThrow(
        'Upload the checked answer sheet',
      );
    });

    it('updates marks without re-uploading by keeping the current checked copy', async () => {
      await service.gradeSubmission({ subjectiveTest: buildTest(), submission: checkedSheet }, { marksAwarded: 120, remarks: 'Good' }, undefined, ADMIN);
      expect(fileStorage.saveUploadThenCommit).not.toHaveBeenCalled();
      expect(repo.saveGrade).toHaveBeenCalledWith(
        'sub-1',
        'old-checked.pdf',
        expect.objectContaining({ marksAwarded: 120, remarks: 'Good', checkedAnswerSheetPath: 'old-checked.pdf', checkedBy: ADMIN.id }),
      );
    });

    it('replaces the checked copy when a new one is uploaded', async () => {
      await service.gradeSubmission({ subjectiveTest: buildTest(), submission: checkedSheet }, { marksAwarded: 120 }, uploadedPdf, ADMIN);
      const { storageKey, replacedStorageKey } = fileStorage.saveUploadThenCommit.mock.calls[0]![0];
      expect(storageKey).toMatch(/^subjective\/1\/st-1\/checked\/sub-1-\d+-\d+\.pdf$/);
      expect(replacedStorageKey).toBe('old-checked.pdf');
    });

    it('returns 409 when someone else graded at the same time', async () => {
      repo.saveGrade.mockRejectedValue(prismaError('P2025'));
      const gradeError = await service
        .gradeSubmission({ subjectiveTest: buildTest(), submission: checkedSheet }, { marksAwarded: 120 }, undefined, ADMIN)
        .catch((error: unknown) => error);
      expect(gradeError).toBeInstanceOf(ApiError);
      expect((gradeError as ApiError).statusCode).toBe(409);
    });
  });

  describe('student views', () => {
    it('lists published tests with the student own attempt in one query', async () => {
      repo.findPublishedTestsWithOwnAttempt.mockResolvedValue([testWithOwnAttempt({}, buildAttempt()), testWithOwnAttempt({ id: 'st-2' })]);
      const testCards = await service.listTestsForStudent(BUSINESS_ID, STUDENT);
      expect(testCards.map((testCard) => testCard.displayStatus)).toEqual([
        SubjectiveDisplayStatus.IN_PROGRESS,
        SubjectiveDisplayStatus.NOT_STARTED,
      ]);
    });

    it('hides marks and the checked copy until the submission is checked', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({
        ...buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED, marksAwarded: 99, answerSheetPath: 'a.pdf' }),
        test: buildTest(),
      });
      const ownSubmission = (await service.getSubmissionDetail(BUSINESS_ID, 'sub-1', STUDENT)) as SubjectiveStudentSubmissionResponse;
      expect(ownSubmission.result).toBeNull();
      expect(repo.findSubmissionWithTest).toHaveBeenCalledWith(BUSINESS_ID, 'sub-1', STUDENT.id);
      await expect(
        service.getSubmissionFileDownload(BUSINESS_ID, 'sub-1', SubjectiveSubmissionFile.CHECKED_COPY, STUDENT),
      ).rejects.toThrow(NotFoundError);
    });

    it('shows marks, remarks and the checked copy once checked', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({
        ...buildAttempt({
          status: SubjectiveSubmissionStatus.CHECKED,
          answerSheetPath: 'a.pdf',
          marksAwarded: 118,
          remarks: 'Good',
          checkedAnswerSheetPath: 'c.pdf',
        }),
        test: buildTest(),
      });
      const ownSubmission = (await service.getSubmissionDetail(BUSINESS_ID, 'sub-1', STUDENT)) as SubjectiveStudentSubmissionResponse;
      expect(ownSubmission.result).toEqual(expect.objectContaining({ marksAwarded: 118, remarks: 'Good', hasCheckedAnswerSheet: true }));
      expect(
        (await service.getSubmissionFileDownload(BUSINESS_ID, 'sub-1', SubjectiveSubmissionFile.CHECKED_COPY, STUDENT)).storageKey,
      ).toBe('c.pdf');
    });

    it("returns 404 for another student's submission", async () => {
      repo.findSubmissionWithTest.mockResolvedValue(null);
      await expect(service.getSubmissionDetail(BUSINESS_ID, 'sub-other', STUDENT)).rejects.toThrow(NotFoundError);
    });
  });

  describe('submission detail and files for staff (same API as students)', () => {
    const submittedSheet = { ...buildAttempt({ status: SubjectiveSubmissionStatus.SUBMITTED, answerSheetPath: 'a.pdf' }), test: buildTest() };

    it('gives staff the grading view with the student profile, looked up by submission id only', async () => {
      repo.findSubmissionWithTest.mockResolvedValue(submittedSheet);
      (userRepo.findBasicProfileById as jest.Mock).mockResolvedValue({ id: STUDENT.id, name: 'S', email: 's@x.com' });

      const staffView = (await service.getSubmissionDetail(BUSINESS_ID, 'sub-1', ADMIN)) as SubjectiveStaffSubmissionResponse;

      expect(repo.findSubmissionWithTest).toHaveBeenCalledWith(BUSINESS_ID, 'sub-1', null);
      expect(staffView.student).toEqual({ id: STUDENT.id, name: 'S', email: 's@x.com' });
      expect(
        (await service.getSubmissionFileDownload(BUSINESS_ID, 'sub-1', SubjectiveSubmissionFile.ANSWER_SHEET, ADMIN)).storageKey,
      ).toBe('a.pdf');
    });

    it('hides the submission from a teacher who did not create the test', async () => {
      repo.findSubmissionWithTest.mockResolvedValue({ ...submittedSheet, test: buildTest({ createdBy: 999 }) });
      await expect(service.getSubmissionDetail(BUSINESS_ID, 'sub-1', TEACHER)).rejects.toThrow(NotFoundError);
      await expect(
        service.getSubmissionFileDownload(BUSINESS_ID, 'sub-1', SubjectiveSubmissionFile.ANSWER_SHEET, TEACHER),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
