import { UserRole } from '@prisma/client';
import { ApiError, BadRequestError, NotFoundError } from '../errors/api.errors';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { PRISMA_ERROR_CODES } from '../constants/prismaErrorCodes.constants';
import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
  TestStatus,
  type SubjectiveSubmissionFile,
} from '../constants/test-enums';
import * as subjectiveTestRepo from '../repositories/subjectiveTest.repo';
import type { SubjectiveSubmissionRecord, SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import * as userRepo from '../repositories/user.repo';
import {
  CreateSubjectiveTestDto,
  GradeSubjectiveSubmissionDto,
  UpdateSubjectiveTestDto,
} from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import { uploadsFileStorage, type StoredFileDownload } from './fileStorage.service';
import { assertBatchBelongsToBusiness, assertSubjectForBatch, assertTestBatchAccess } from '../utils/test.utils';
import { hasPrismaErrorCode, translatePrismaError } from '../utils/prismaError';
import type { TestRequestActor } from '../utils/testController.utils';
import { pickDefined } from '../utils/objectUtils';
import {
  DRAFT_TEST_EDITABLE_FIELDS,
  assertDeadlineAfterStart,
  buildAnswerSheetStorageKey,
  buildCheckedCopyStorageKey,
  buildQuestionPaperStorageKey,
  computeAttemptDeadline,
  getSubmissionDisplayStatus,
  getTestAvailability,
  questionPaperDownload,
  submissionFileDownload,
  subjectiveTestStorageFolder,
  type StaffTestListFilters,
  type SubmissionListFilters,
} from '../utils/subjectiveTest.utils';
import logger from '../utils/logger';

const TEST_LABEL = 'Subjective test';

/** A submission and its test, loaded and access-checked for a staff member. */
export type StaffSubmissionContext = { test: SubjectiveTestRecord; submission: SubjectiveSubmissionRecord };
/** A student's open (in progress, not timed out) attempt and its test. */
export type StudentOpenAttemptContext = { test: SubjectiveTestRecord; attempt: SubjectiveSubmissionRecord };

const isAdminRole = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.SUPERADMIN;

export class SubjectiveTestService {
  // ---------------------------------------------------------------------------
  // Access checks (also used by subjectiveTestAccess.middleware before multer runs)
  // ---------------------------------------------------------------------------

  /** Admins manage every test in the business; teachers only tests they created in their batches. */
  private async assertStaffCanManageTest(test: SubjectiveTestRecord | null, subjectiveTestId: string, actor: TestRequestActor) {
    if (!test || (!isAdminRole(actor.role) && test.createdBy !== actor.id)) {
      logger.warn(`[subjective-test] staff access denied subjectiveTestId=${subjectiveTestId} userId=${actor.id} role=${actor.role}`);
      throw new NotFoundError(TEST_LABEL);
    }
    await assertTestBatchAccess({
      user: actor,
      batchId: test.batchId,
      businessId: test.businessId,
      entityLabel: TEST_LABEL,
      entityId: test.id,
    });
    logger.debug(`[subjective-test] staff access granted subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return test;
  }

  async findTestForStaff(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    const test = await subjectiveTestRepo.findTestInBusiness(businessId, subjectiveTestId);
    return this.assertStaffCanManageTest(test, subjectiveTestId, actor);
  }

  async findDraftTestForStaff(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    const test = await this.findTestForStaff(businessId, subjectiveTestId, actor);
    if (test.status !== TestStatus.DRAFT) {
      logger.warn(`[subjective-test] change blocked: test is published subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new BadRequestError('A published test cannot be changed');
    }
    logger.debug(`[subjective-test] draft test loaded subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return test;
  }

  async findSubmissionForStaff(
    businessId: number,
    subjectiveTestId: string,
    submissionId: string,
    actor: TestRequestActor,
  ): Promise<StaffSubmissionContext> {
    const submissionWithTest = await subjectiveTestRepo.findSubmissionWithTest(businessId, subjectiveTestId, submissionId);
    if (!submissionWithTest) {
      logger.warn(`[subjective-test] submission not found subjectiveTestId=${subjectiveTestId} submissionId=${submissionId}`);
      throw new NotFoundError('Submission');
    }
    const { test, ...submission } = submissionWithTest;
    await this.assertStaffCanManageTest(test, subjectiveTestId, actor);
    logger.debug(`[subjective-test] submission loaded for staff submissionId=${submissionId} status=${submission.status}`);
    return { test, submission };
  }

  async findGradableSubmissionForStaff(
    businessId: number,
    subjectiveTestId: string,
    submissionId: string,
    actor: TestRequestActor,
  ): Promise<StaffSubmissionContext> {
    const gradable = await this.findSubmissionForStaff(businessId, subjectiveTestId, submissionId, actor);
    if (gradable.submission.status === SubjectiveSubmissionStatus.IN_PROGRESS) {
      logger.warn(`[subjective-test] grade blocked: not submitted yet submissionId=${submissionId} userId=${actor.id}`);
      throw new BadRequestError('Only submitted answer sheets can be graded');
    }
    logger.info(`[subjective-test] gradable submission loaded submissionId=${submissionId} userId=${actor.id}`);
    return gradable;
  }

  async findOpenAttemptForStudent(
    businessId: number,
    subjectiveTestId: string,
    actor: TestRequestActor,
  ): Promise<StudentOpenAttemptContext> {
    const { test, ownAttempt } = await this.findPublishedTestForStudent(businessId, subjectiveTestId, actor);
    if (!ownAttempt) {
      logger.warn(`[subjective-test] submit blocked: test not started subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new BadRequestError('Start the test before submitting');
    }
    this.assertAttemptStillOpen(test, ownAttempt, actor);
    logger.info(`[subjective-test] open attempt loaded submissionId=${ownAttempt.id} userId=${actor.id}`);
    return { test, attempt: ownAttempt };
  }

  private async findPublishedTestForStudent(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    const testWithOwnAttempt = await subjectiveTestRepo.findPublishedTestWithOwnAttempt(businessId, subjectiveTestId, actor.id);
    if (!testWithOwnAttempt) {
      logger.warn(`[subjective-test] student test not found subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new NotFoundError(TEST_LABEL);
    }
    const { submissions, ...test } = testWithOwnAttempt;
    logger.debug(
      `[subjective-test] student test loaded subjectiveTestId=${subjectiveTestId} userId=${actor.id} hasAttempt=${submissions.length > 0}`,
    );
    return { test, ownAttempt: submissions[0] ?? null };
  }

  private assertAttemptStillOpen(test: SubjectiveTestRecord, attempt: SubjectiveSubmissionRecord, actor: TestRequestActor) {
    const displayStatus = getSubmissionDisplayStatus(test, attempt, new Date());
    if (displayStatus === SubjectiveDisplayStatus.IN_PROGRESS) {
      logger.debug(`[subjective-test] attempt is open submissionId=${attempt.id} userId=${actor.id}`);
      return;
    }

    logger.warn(`[subjective-test] attempt not open submissionId=${attempt.id} userId=${actor.id} status=${displayStatus}`);
    throw new BadRequestError(
      displayStatus === SubjectiveDisplayStatus.EXPIRED ? 'Your time for this test is over' : 'You have already submitted this test',
    );
  }

  private async assertBatchAndSubjectAllowed(
    businessId: number,
    batchId: number,
    subjectId: number | null | undefined,
    actor: TestRequestActor,
  ) {
    await Promise.all([
      assertBatchBelongsToBusiness(businessId, batchId),
      assertTestBatchAccess({ user: actor, batchId, businessId, entityLabel: TEST_LABEL, entityId: String(batchId) }),
      subjectId ? assertSubjectForBatch({ batchId, subjectId, businessId, userId: actor.id }) : undefined,
    ]);
    logger.debug(`[subjective-test] batch and subject allowed batchId=${batchId} subjectId=${subjectId ?? 'none'} userId=${actor.id}`);
  }

  // ---------------------------------------------------------------------------
  // Staff: manage tests
  // ---------------------------------------------------------------------------

  async createDraftTest(businessId: number, dto: CreateSubjectiveTestDto, actor: TestRequestActor) {
    logger.info(`[subjective-test] createDraftTest businessId=${businessId} userId=${actor.id} batchId=${dto.batchId}`);
    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    assertDeadlineAfterStart(startAt, deadlineAt);
    await this.assertBatchAndSubjectAllowed(businessId, dto.batchId, dto.subjectId, actor);

    const draftTest = await subjectiveTestRepo.insertDraftTest({
      businessId,
      batchId: dto.batchId,
      subjectId: dto.subjectId ?? null,
      name: dto.name,
      paperType: dto.paperType,
      description: dto.description ?? null,
      instructions: dto.instructions ?? null,
      totalMarks: dto.totalMarks,
      durationMinutes: dto.durationMinutes,
      startAt,
      deadlineAt,
      status: TestStatus.DRAFT,
      createdBy: actor.id,
    });
    logger.info(`[subjective-test] draft test created subjectiveTestId=${draftTest.id} businessId=${businessId} userId=${actor.id}`);
    return draftTest;
  }

  async listTestsForStaff(
    businessId: number,
    filters: StaffTestListFilters,
    actor: TestRequestActor,
  ) {
    logger.info(`[subjective-test] listTestsForStaff businessId=${businessId} userId=${actor.id} role=${actor.role}`);
    const tests = await subjectiveTestRepo.findTestsInBusiness(businessId, {
      ...filters,
      ...(isAdminRole(actor.role) ? {} : { createdBy: actor.id }),
    });
    logger.info(`[subjective-test] tests listed for staff businessId=${businessId} userId=${actor.id} count=${tests.length}`);
    return tests;
  }

  async getTestDetailForStaff(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] getTestDetailForStaff businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const test = await this.findTestForStaff(businessId, subjectiveTestId, actor);
    const [notStartedCount, attemptTimings] = await Promise.all([
      subjectiveTestRepo.countStudentsNotStarted(businessId, test.id, test.batchId),
      subjectiveTestRepo.findAttemptTimingsForTest(test.id),
    ]);

    const submissionCounts = Object.fromEntries(
      Object.values(SubjectiveDisplayStatus).map((displayStatus) => [displayStatus, 0]),
    ) as Record<SubjectiveDisplayStatus, number>;
    submissionCounts[SubjectiveDisplayStatus.NOT_STARTED] = notStartedCount;
    const now = new Date();
    for (const attemptTiming of attemptTimings) {
      submissionCounts[getSubmissionDisplayStatus(test, attemptTiming, now)] += 1;
    }
    logger.info(
      `[subjective-test] test detail fetched subjectiveTestId=${subjectiveTestId} counts=${JSON.stringify(submissionCounts)}`,
    );
    return { test, submissionCounts };
  }

  async updateDraftTest(businessId: number, subjectiveTestId: string, dto: UpdateSubjectiveTestDto, actor: TestRequestActor) {
    logger.info(`[subjective-test] updateDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const draftTest = await this.findDraftTestForStaff(businessId, subjectiveTestId, actor);
    const editedFields = pickDefined(dto, DRAFT_TEST_EDITABLE_FIELDS);
    const editedTest = { ...draftTest, ...editedFields };
    const startAt = dto.startAt ? new Date(dto.startAt) : draftTest.startAt;
    const deadlineAt = dto.deadlineAt ? new Date(dto.deadlineAt) : draftTest.deadlineAt;
    assertDeadlineAfterStart(startAt, deadlineAt);

    if (dto.batchId !== undefined || dto.subjectId !== undefined) {
      await this.assertBatchAndSubjectAllowed(businessId, editedTest.batchId, editedTest.subjectId, actor);
    }

    const updatedTest = await subjectiveTestRepo.updateTest(businessId, subjectiveTestId, {
      ...editedFields,
      startAt,
      deadlineAt,
      updatedBy: actor.id,
    });
    logger.info(`[subjective-test] draft test updated subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return updatedTest;
  }

  /** `draftTest` is already loaded and access-checked by the middleware that ran before the upload. */
  async replaceQuestionPaper(draftTest: SubjectiveTestRecord, uploadedFile: Express.Multer.File, actor: TestRequestActor) {
    logger.info(`[subjective-test] replaceQuestionPaper subjectiveTestId=${draftTest.id} userId=${actor.id}`);
    const questionPaperPath = buildQuestionPaperStorageKey(draftTest.businessId, draftTest.id);
    const updatedTest = await uploadsFileStorage.saveUploadThenCommit({
      uploadedFile,
      storageKey: questionPaperPath,
      replacedStorageKey: draftTest.questionPaperPath,
      commitToDatabase: () =>
        subjectiveTestRepo.updateTest(draftTest.businessId, draftTest.id, { questionPaperPath, updatedBy: actor.id }),
    });
    logger.info(`[subjective-test] question paper saved subjectiveTestId=${draftTest.id} storageKey=${questionPaperPath}`);
    return updatedTest;
  }

  /** Marks, duration and dates are validated on create/update; publish only checks what can change after that. */
  async publishDraftTest(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] publishDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const draftTest = await this.findDraftTestForStaff(businessId, subjectiveTestId, actor);
    if (!draftTest.questionPaperPath) {
      logger.warn(`[subjective-test] publish blocked: no question paper subjectiveTestId=${subjectiveTestId}`);
      throw new BadRequestError('Upload the question paper before publishing');
    }
    if (draftTest.deadlineAt <= new Date()) {
      logger.warn(`[subjective-test] publish blocked: deadline passed subjectiveTestId=${subjectiveTestId}`);
      throw new BadRequestError('The deadline has already passed. Update it before publishing');
    }
    const publishedTest = await subjectiveTestRepo.updateTest(businessId, subjectiveTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: actor.id,
    });
    logger.info(`[subjective-test] test published subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return publishedTest;
  }

  /** Students can only start published tests, so a draft never has submissions to protect. */
  async deleteDraftTest(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] deleteDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    await this.findDraftTestForStaff(businessId, subjectiveTestId, actor);
    await subjectiveTestRepo.deleteTest(businessId, subjectiveTestId);
    await uploadsFileStorage.deleteFolderIfExists(subjectiveTestStorageFolder(businessId, subjectiveTestId));
    logger.info(`[subjective-test] draft test deleted subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
  }

  /** Staff can always download; students only after they started the test. */
  async getQuestionPaperDownload(businessId: number, subjectiveTestId: string, actor: TestRequestActor): Promise<StoredFileDownload> {
    logger.info(`[subjective-test] getQuestionPaperDownload subjectiveTestId=${subjectiveTestId} userId=${actor.id} role=${actor.role}`);
    if (actor.role !== UserRole.STUDENT) {
      const staffDownload = questionPaperDownload(await this.findTestForStaff(businessId, subjectiveTestId, actor));
      logger.info(`[subjective-test] question paper ready for staff subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return staffDownload;
    }
    const { test, ownAttempt } = await this.findPublishedTestForStudent(businessId, subjectiveTestId, actor);
    if (!ownAttempt) {
      logger.warn(`[subjective-test] question paper blocked: test not started subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new BadRequestError('Start the test to view the question paper');
    }
    const studentDownload = questionPaperDownload(test);
    logger.info(`[subjective-test] question paper ready for student subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return studentDownload;
  }

  // ---------------------------------------------------------------------------
  // Staff: submissions and grading
  // ---------------------------------------------------------------------------

  async listRosterForStaff(businessId: number, subjectiveTestId: string, filters: SubmissionListFilters, actor: TestRequestActor) {
    logger.info(
      `[subjective-test] listRosterForStaff subjectiveTestId=${subjectiveTestId} userId=${actor.id} status=${filters.displayStatus ?? 'any'}`,
    );
    const test = await this.findTestForStaff(businessId, subjectiveTestId, actor);
    const rosterEntries = await subjectiveTestRepo.findRosterWithSubmissions(businessId, test.id, test.batchId);

    const now = new Date();
    const matchingEntries = rosterEntries
      .map((rosterEntry) => SubjectiveTestMapper.toRosterEntryResponse(test, rosterEntry, now))
      .filter(
        (rosterEntry) =>
          (!filters.displayStatus || rosterEntry.displayStatus === filters.displayStatus) &&
          (!filters.searchText ||
            rosterEntry.studentName.toLowerCase().includes(filters.searchText) ||
            rosterEntry.studentEmail.toLowerCase().includes(filters.searchText)),
      );

    const firstIndexOnPage = (filters.page - 1) * filters.pageSize;
    logger.info(
      `[subjective-test] roster listed subjectiveTestId=${subjectiveTestId} total=${matchingEntries.length} page=${filters.page}`,
    );
    return {
      items: matchingEntries.slice(firstIndexOnPage, firstIndexOnPage + filters.pageSize),
      total: matchingEntries.length,
      page: filters.page,
      limit: filters.pageSize,
    };
  }

  async getSubmissionDetailForStaff(businessId: number, subjectiveTestId: string, submissionId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] getSubmissionDetailForStaff submissionId=${submissionId} userId=${actor.id}`);
    const { test, submission } = await this.findSubmissionForStaff(businessId, subjectiveTestId, submissionId, actor);
    const student = await userRepo.findBasicProfileById(submission.studentId);
    logger.info(`[subjective-test] submission detail fetched submissionId=${submissionId} studentFound=${Boolean(student)}`);
    return SubjectiveTestMapper.toStaffSubmissionResponse(test, submission, student, new Date());
  }

  async getSubmissionFileDownloadForStaff(
    businessId: number,
    subjectiveTestId: string,
    submissionId: string,
    submissionFile: SubjectiveSubmissionFile,
    actor: TestRequestActor,
  ) {
    logger.info(`[subjective-test] getSubmissionFileDownloadForStaff submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    const { test, submission } = await this.findSubmissionForStaff(businessId, subjectiveTestId, submissionId, actor);
    const download = submissionFileDownload(test, submission, submissionFile);
    logger.info(`[subjective-test] submission file ready for staff submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    return download;
  }

  /**
   * `gradable` is loaded by the middleware before the upload. The checked copy is required on
   * the first grade; later grades may change only marks/remarks and keep the current copy.
   */
  async gradeSubmission(
    gradable: StaffSubmissionContext,
    dto: GradeSubjectiveSubmissionDto,
    uploadedCheckedCopy: Express.Multer.File | undefined,
    actor: TestRequestActor,
  ) {
    const { test, submission } = gradable;
    logger.info(
      `[subjective-test] gradeSubmission submissionId=${submission.id} userId=${actor.id} hasNewCheckedCopy=${Boolean(uploadedCheckedCopy)}`,
    );
    if (dto.marksAwarded > test.totalMarks) {
      logger.warn(`[subjective-test] grade blocked: marks above total submissionId=${submission.id} marks=${dto.marksAwarded}`);
      throw new BadRequestError(`Marks cannot be more than ${test.totalMarks}`);
    }
    const currentCheckedCopyPath = submission.checkedAnswerSheetPath;
    if (!uploadedCheckedCopy && !currentCheckedCopyPath) {
      logger.warn(`[subjective-test] grade blocked: no checked copy submissionId=${submission.id}`);
      throw new BadRequestError('Upload the checked answer sheet');
    }

    const saveGradeWithCheckedCopy = (checkedAnswerSheetPath: string) =>
      subjectiveTestRepo
        .saveGrade(submission.id, currentCheckedCopyPath, {
          marksAwarded: dto.marksAwarded,
          remarks: dto.remarks || null,
          checkedAnswerSheetPath,
          checkedBy: actor.id,
          checkedAt: new Date(),
        })
        .catch((error: unknown) =>
          translatePrismaError(error, {
            [PRISMA_ERROR_CODES.RECORD_NOT_FOUND]: () =>
              new ApiError('This submission was just updated by someone else. Refresh and try again', HTTP_STATUS.CONFLICT),
          }),
        );

    const saveGradeAndCheckedCopy = async () => {
      if (!uploadedCheckedCopy) return saveGradeWithCheckedCopy(currentCheckedCopyPath!);
      const newCheckedCopyPath = buildCheckedCopyStorageKey(test.businessId, test.id, submission.id);
      return uploadsFileStorage.saveUploadThenCommit({
        uploadedFile: uploadedCheckedCopy,
        storageKey: newCheckedCopyPath,
        replacedStorageKey: currentCheckedCopyPath,
        commitToDatabase: () => saveGradeWithCheckedCopy(newCheckedCopyPath),
      });
    };

    const [gradedSubmission, student] = await Promise.all([
      saveGradeAndCheckedCopy(),
      userRepo.findBasicProfileById(submission.studentId),
    ]);
    logger.info(
      `[subjective-test] submission graded submissionId=${submission.id} marks=${dto.marksAwarded}/${test.totalMarks} userId=${actor.id}`,
    );
    return SubjectiveTestMapper.toStaffSubmissionResponse(test, gradedSubmission, student, new Date());
  }

  // ---------------------------------------------------------------------------
  // Student
  // ---------------------------------------------------------------------------

  async listTestsForStudent(businessId: number, actor: TestRequestActor) {
    logger.info(`[subjective-test] listTestsForStudent businessId=${businessId} userId=${actor.id}`);
    const testsWithOwnAttempt = await subjectiveTestRepo.findPublishedTestsWithOwnAttempt(businessId, actor.id);
    const now = new Date();
    logger.info(`[subjective-test] tests listed for student businessId=${businessId} userId=${actor.id} count=${testsWithOwnAttempt.length}`);
    return testsWithOwnAttempt.map(({ submissions, ...test }) =>
      SubjectiveTestMapper.toStudentTestCardResponse(test, submissions[0] ?? null, now),
    );
  }

  async startOrResumeAttempt(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] startOrResumeAttempt subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const { test, ownAttempt } = await this.findPublishedTestForStudent(businessId, subjectiveTestId, actor);

    const toStartedAttemptResponse = (attempt: SubjectiveSubmissionRecord) => {
      this.assertAttemptStillOpen(test, attempt, actor);
      logger.info(`[subjective-test] attempt ready submissionId=${attempt.id} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return {
        submissionId: attempt.id,
        displayStatus: SubjectiveDisplayStatus.IN_PROGRESS,
        startedAt: attempt.startedAt,
        effectiveDeadlineAt: computeAttemptDeadline(test, attempt.startedAt),
      };
    };
    if (ownAttempt) return toStartedAttemptResponse(ownAttempt);

    const now = new Date();
    const availability = getTestAvailability(test, now);
    if (availability !== SubjectiveAvailability.OPEN) {
      logger.warn(`[subjective-test] start blocked subjectiveTestId=${subjectiveTestId} userId=${actor.id} availability=${availability}`);
      throw new BadRequestError(
        availability === SubjectiveAvailability.UPCOMING ? 'This test has not started yet' : 'The deadline for this test has passed',
      );
    }

    try {
      return toStartedAttemptResponse(await subjectiveTestRepo.insertInProgressAttempt(test.id, actor.id, now));
    } catch (error) {
      // A double click already created the attempt: resume that one instead.
      if (!hasPrismaErrorCode(error, PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION)) {
        logger.error(`[subjective-test] start failed subjectiveTestId=${subjectiveTestId} userId=${actor.id}: ${(error as Error).message}`);
        throw error;
      }
      logger.info(`[subjective-test] concurrent start resumed subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return toStartedAttemptResponse((await subjectiveTestRepo.findAttemptByTestAndStudent(test.id, actor.id))!);
    }
  }

  /** `openAttempt` is loaded and checked (in progress, not timed out) before the upload. */
  async submitAnswerSheet(openAttempt: StudentOpenAttemptContext, uploadedAnswerSheet: Express.Multer.File, actor: TestRequestActor) {
    const { test, attempt } = openAttempt;
    logger.info(`[subjective-test] submitAnswerSheet submissionId=${attempt.id} userId=${actor.id}`);
    const submittedAt = new Date();
    const answerSheetPath = buildAnswerSheetStorageKey(test.businessId, test.id, actor.id, uploadedAnswerSheet);

    await uploadsFileStorage.saveUploadThenCommit({
      uploadedFile: uploadedAnswerSheet,
      storageKey: answerSheetPath,
      commitToDatabase: () =>
        subjectiveTestRepo.markAttemptSubmitted(attempt.id, answerSheetPath, submittedAt).catch((error: unknown) =>
          translatePrismaError(error, {
            [PRISMA_ERROR_CODES.RECORD_NOT_FOUND]: () => new BadRequestError('You have already submitted this test'),
          }),
        ),
    });
    logger.info(`[subjective-test] answer sheet submitted submissionId=${attempt.id} userId=${actor.id} storageKey=${answerSheetPath}`);
    return { submissionId: attempt.id, displayStatus: SubjectiveDisplayStatus.SUBMITTED, submittedAt };
  }

  private async findOwnSubmission(businessId: number, submissionId: string, actor: TestRequestActor) {
    const ownSubmissionWithTest = await subjectiveTestRepo.findOwnSubmissionWithTest(businessId, submissionId, actor.id);
    if (!ownSubmissionWithTest) {
      logger.warn(`[subjective-test] own submission not found submissionId=${submissionId} userId=${actor.id}`);
      throw new NotFoundError('Submission');
    }
    const { test, ...submission } = ownSubmissionWithTest;
    logger.debug(`[subjective-test] own submission loaded submissionId=${submissionId} status=${submission.status}`);
    return { test, submission };
  }

  async getOwnAttemptDetail(businessId: number, submissionId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] getOwnAttemptDetail submissionId=${submissionId} userId=${actor.id}`);
    const { test, submission } = await this.findOwnSubmission(businessId, submissionId, actor);
    const ownAttempt = SubjectiveTestMapper.toStudentAttemptResponse(test, submission, new Date());
    logger.info(`[subjective-test] own attempt fetched submissionId=${submissionId} status=${ownAttempt.displayStatus}`);
    return ownAttempt;
  }

  async getOwnSubmissionFileDownload(
    businessId: number,
    submissionId: string,
    submissionFile: SubjectiveSubmissionFile,
    actor: TestRequestActor,
  ) {
    logger.info(`[subjective-test] getOwnSubmissionFileDownload submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    const { test, submission } = await this.findOwnSubmission(businessId, submissionId, actor);
    const download = submissionFileDownload(test, submission, submissionFile);
    logger.info(`[subjective-test] own submission file ready submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    return download;
  }
}

export const subjectiveTestService = new SubjectiveTestService();
