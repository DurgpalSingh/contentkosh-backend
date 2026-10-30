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
  STUDENT_ATTEMPT_REQUIREMENT,
  SUBJECTIVE_TEST_DTO_FIELDS,
  SUBJECTIVE_TEST_LABELS,
  type StudentAttemptRequirement,
} from '../constants/subjectiveTest.constants';
import {
  assertDeadlineAfterStart,
  buildAnswerSheetStorageKey,
  buildCheckedCopyStorageKey,
  buildQuestionPaperStorageKey,
  computeAttemptDeadline,
  getSubmissionDisplayStatus,
  getTestAvailability,
  isAdminRole,
  questionPaperDownload,
  submissionFileDownload,
  subjectiveTestStorageFolder,
  type StaffTestListFilters,
  type SubmissionListFilters,
} from '../utils/subjectiveTest.utils';
import logger from '../utils/logger';

export type SubmissionContext = { subjectiveTest: SubjectiveTestRecord; submission: SubjectiveSubmissionRecord };
export type StudentTestContext = { subjectiveTest: SubjectiveTestRecord; ownAttempt: SubjectiveSubmissionRecord | null };
export type StudentOpenAttemptContext = StudentTestContext & { ownAttempt: SubjectiveSubmissionRecord };

const ATTEMPT_REQUIRED_MESSAGES: Record<Exclude<StudentAttemptRequirement, typeof STUDENT_ATTEMPT_REQUIREMENT.NONE>, string> = {
  [STUDENT_ATTEMPT_REQUIREMENT.STARTED]: 'Start the test to view the question paper',
  [STUDENT_ATTEMPT_REQUIREMENT.OPEN]: 'Start the test before submitting',
};

export class SubjectiveTestService {
  // Lookups and access checks (also run by subjectiveTestAccess.middleware before uploads)

  /** Admins manage every test in the business; teachers only tests they created in their batches. */
  private async assertStaffCanManageTest(
    subjectiveTest: SubjectiveTestRecord | null,
    subjectiveTestId: string,
    actor: TestRequestActor,
  ): Promise<SubjectiveTestRecord> {
    if (!subjectiveTest || (!isAdminRole(actor.role) && subjectiveTest.createdBy !== actor.id)) {
      logger.warn(`[subjective-test] staff access denied subjectiveTestId=${subjectiveTestId} userId=${actor.id} role=${actor.role}`);
      throw new NotFoundError(SUBJECTIVE_TEST_LABELS.SUBJECTIVE_TEST);
    }
    await assertTestBatchAccess({
      user: actor,
      batchId: subjectiveTest.batchId,
      businessId: subjectiveTest.businessId,
      entityLabel: SUBJECTIVE_TEST_LABELS.SUBJECTIVE_TEST,
      entityId: subjectiveTest.id,
    });
    logger.debug(`[subjective-test] staff access granted subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return subjectiveTest;
  }

  async findTestForStaff(
    businessId: number,
    subjectiveTestId: string,
    actor: TestRequestActor,
    { draftOnly = false }: { draftOnly?: boolean } = {},
  ): Promise<SubjectiveTestRecord> {
    const subjectiveTest = await this.assertStaffCanManageTest(
      await subjectiveTestRepo.findTestInBusiness(businessId, subjectiveTestId),
      subjectiveTestId,
      actor,
    );
    if (draftOnly && subjectiveTest.status !== TestStatus.DRAFT) {
      logger.warn(`[subjective-test] change blocked: test is published subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new BadRequestError('A published test cannot be changed');
    }
    logger.debug(`[subjective-test] test loaded for staff subjectiveTestId=${subjectiveTestId} userId=${actor.id} draftOnly=${draftOnly}`);
    return subjectiveTest;
  }

  /** Staff see any submission of a test they manage; a student only their own submission of a published test. */
  async findSubmission(
    businessId: number,
    submissionId: string,
    actor: TestRequestActor,
    { submittedOnly = false }: { submittedOnly?: boolean } = {},
  ): Promise<SubmissionContext> {
    const isStudent = actor.role === UserRole.STUDENT;
    const submissionWithTest = await subjectiveTestRepo.findSubmissionWithTest(businessId, submissionId, isStudent ? actor.id : null);
    if (!submissionWithTest) {
      logger.warn(`[subjective-test] submission not found submissionId=${submissionId} userId=${actor.id} role=${actor.role}`);
      throw new NotFoundError(SUBJECTIVE_TEST_LABELS.SUBMISSION);
    }
    const { test: subjectiveTest, ...submission } = submissionWithTest;
    if (!isStudent) await this.assertStaffCanManageTest(subjectiveTest, subjectiveTest.id, actor);
    if (submittedOnly && submission.status === SubjectiveSubmissionStatus.IN_PROGRESS) {
      logger.warn(`[subjective-test] grade blocked: not submitted yet submissionId=${submissionId} userId=${actor.id}`);
      throw new BadRequestError('Only submitted answer sheets can be graded');
    }
    logger.debug(`[subjective-test] submission loaded submissionId=${submissionId} status=${submission.status} userId=${actor.id}`);
    return { subjectiveTest, submission };
  }

  /** A published test of the student's batch and their own attempt; OPEN also requires it to be in progress and not timed out. */
  async findPublishedTestForStudent(
    businessId: number,
    subjectiveTestId: string,
    actor: TestRequestActor,
    requiredAttempt: typeof STUDENT_ATTEMPT_REQUIREMENT.NONE,
  ): Promise<StudentTestContext>;
  async findPublishedTestForStudent(
    businessId: number,
    subjectiveTestId: string,
    actor: TestRequestActor,
    requiredAttempt: typeof STUDENT_ATTEMPT_REQUIREMENT.STARTED | typeof STUDENT_ATTEMPT_REQUIREMENT.OPEN,
  ): Promise<StudentOpenAttemptContext>;
  async findPublishedTestForStudent(
    businessId: number,
    subjectiveTestId: string,
    actor: TestRequestActor,
    requiredAttempt: StudentAttemptRequirement,
  ): Promise<StudentTestContext> {
    const testWithOwnAttempt = await subjectiveTestRepo.findPublishedTestWithOwnAttempt(businessId, subjectiveTestId, actor.id);
    if (!testWithOwnAttempt) {
      logger.warn(`[subjective-test] student test not found subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      throw new NotFoundError(SUBJECTIVE_TEST_LABELS.SUBJECTIVE_TEST);
    }
    const { submissions: ownAttempts, ...subjectiveTest } = testWithOwnAttempt;
    const ownAttempt = ownAttempts[0] ?? null;

    if (requiredAttempt !== STUDENT_ATTEMPT_REQUIREMENT.NONE) {
      if (!ownAttempt) {
        logger.warn(
          `[subjective-test] blocked: test not started subjectiveTestId=${subjectiveTestId} userId=${actor.id} required=${requiredAttempt}`,
        );
        throw new BadRequestError(ATTEMPT_REQUIRED_MESSAGES[requiredAttempt]);
      }
      if (requiredAttempt === STUDENT_ATTEMPT_REQUIREMENT.OPEN) this.assertAttemptStillOpen(subjectiveTest, ownAttempt, actor);
    }
    logger.debug(
      `[subjective-test] student test loaded subjectiveTestId=${subjectiveTestId} userId=${actor.id} hasAttempt=${Boolean(ownAttempt)} required=${requiredAttempt}`,
    );
    return { subjectiveTest, ownAttempt };
  }

  private assertAttemptStillOpen(subjectiveTest: SubjectiveTestRecord, attempt: SubjectiveSubmissionRecord, actor: TestRequestActor) {
    const displayStatus = getSubmissionDisplayStatus(subjectiveTest, attempt, new Date());
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
      assertTestBatchAccess({ user: actor, batchId, businessId, entityLabel: SUBJECTIVE_TEST_LABELS.SUBJECTIVE_TEST, entityId: String(batchId) }),
      subjectId ? assertSubjectForBatch({ batchId, subjectId, businessId, userId: actor.id }) : undefined,
    ]);
    logger.debug(`[subjective-test] batch and subject allowed batchId=${batchId} subjectId=${subjectId ?? 'none'} userId=${actor.id}`);
  }

  // GET

  async listTestsForStaff(businessId: number, filters: StaffTestListFilters, actor: TestRequestActor) {
    logger.info(`[subjective-test] listTestsForStaff businessId=${businessId} userId=${actor.id} role=${actor.role}`);
    const subjectiveTests = await subjectiveTestRepo.findTestsInBusiness(businessId, {
      ...filters,
      ...(isAdminRole(actor.role) ? {} : { createdBy: actor.id }),
    });
    logger.info(`[subjective-test] tests listed for staff businessId=${businessId} userId=${actor.id} count=${subjectiveTests.length}`);
    return subjectiveTests;
  }

  async getTestDetailForStaff(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] getTestDetailForStaff businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const testWithCounts = await subjectiveTestRepo.findTestWithSubmissionCounts(businessId, subjectiveTestId, new Date());
    const subjectiveTest = await this.assertStaffCanManageTest(testWithCounts?.subjectiveTest ?? null, subjectiveTestId, actor);
    const submissionCounts = testWithCounts!.submissionCounts;
    logger.info(`[subjective-test] test detail fetched subjectiveTestId=${subjectiveTestId} counts=${JSON.stringify(submissionCounts)}`);
    return { subjectiveTest, submissionCounts };
  }

  /** Staff any time; students only after starting the test. */
  async getQuestionPaperDownload(businessId: number, subjectiveTestId: string, actor: TestRequestActor): Promise<StoredFileDownload> {
    logger.info(`[subjective-test] getQuestionPaperDownload subjectiveTestId=${subjectiveTestId} userId=${actor.id} role=${actor.role}`);
    if (actor.role !== UserRole.STUDENT) {
      const staffDownload = questionPaperDownload(await this.findTestForStaff(businessId, subjectiveTestId, actor));
      logger.info(`[subjective-test] question paper ready for staff subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return staffDownload;
    }
    const { subjectiveTest } = await this.findPublishedTestForStudent(
      businessId,
      subjectiveTestId,
      actor,
      STUDENT_ATTEMPT_REQUIREMENT.STARTED,
    );
    const studentDownload = questionPaperDownload(subjectiveTest);
    logger.info(`[subjective-test] question paper ready for student subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return studentDownload;
  }

  async listRosterForStaff(businessId: number, subjectiveTestId: string, filters: SubmissionListFilters, actor: TestRequestActor) {
    logger.info(
      `[subjective-test] listRosterForStaff subjectiveTestId=${subjectiveTestId} userId=${actor.id} status=${filters.displayStatus ?? 'any'}`,
    );
    const [, { rosterEntries, totalMatching }] = await Promise.all([
      this.findTestForStaff(businessId, subjectiveTestId, actor),
      subjectiveTestRepo.findRosterPage(businessId, subjectiveTestId, filters, new Date()),
    ]);
    logger.info(`[subjective-test] roster listed subjectiveTestId=${subjectiveTestId} total=${totalMatching} page=${filters.page}`);
    return {
      items: rosterEntries.map(SubjectiveTestMapper.toRosterEntryResponse),
      total: totalMatching,
      page: filters.page,
      limit: filters.pageSize,
    };
  }

  async getSubmissionDetail(businessId: number, submissionId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] getSubmissionDetail submissionId=${submissionId} userId=${actor.id} role=${actor.role}`);
    const { subjectiveTest, submission } = await this.findSubmission(businessId, submissionId, actor);
    if (actor.role === UserRole.STUDENT) {
      const ownSubmissionDetail = SubjectiveTestMapper.toStudentAttemptResponse(subjectiveTest, submission, new Date());
      logger.info(`[subjective-test] own submission detail fetched submissionId=${submissionId} status=${ownSubmissionDetail.displayStatus}`);
      return ownSubmissionDetail;
    }
    const student = await userRepo.findBasicProfileById(submission.studentId);
    logger.info(`[subjective-test] staff submission detail fetched submissionId=${submissionId} studentFound=${Boolean(student)}`);
    return SubjectiveTestMapper.toStaffSubmissionResponse(subjectiveTest, submission, student, new Date());
  }

  async getSubmissionFileDownload(
    businessId: number,
    submissionId: string,
    submissionFile: SubjectiveSubmissionFile,
    actor: TestRequestActor,
  ): Promise<StoredFileDownload> {
    logger.info(`[subjective-test] getSubmissionFileDownload submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    const { subjectiveTest, submission } = await this.findSubmission(businessId, submissionId, actor);
    const download = submissionFileDownload(subjectiveTest, submission, submissionFile);
    logger.info(`[subjective-test] submission file ready submissionId=${submissionId} file=${submissionFile} userId=${actor.id}`);
    return download;
  }

  async listTestsForStudent(businessId: number, actor: TestRequestActor) {
    logger.info(`[subjective-test] listTestsForStudent businessId=${businessId} userId=${actor.id}`);
    const testsWithOwnAttempt = await subjectiveTestRepo.findPublishedTestsWithOwnAttempt(businessId, actor.id);
    const now = new Date();
    logger.info(`[subjective-test] tests listed for student businessId=${businessId} userId=${actor.id} count=${testsWithOwnAttempt.length}`);
    return testsWithOwnAttempt.map(({ submissions: ownAttempts, ...subjectiveTest }) =>
      SubjectiveTestMapper.toStudentTestCardResponse(subjectiveTest, ownAttempts[0] ?? null, now),
    );
  }

  // POST

  async createDraftTest(businessId: number, dto: CreateSubjectiveTestDto, actor: TestRequestActor) {
    logger.info(`[subjective-test] createDraftTest businessId=${businessId} userId=${actor.id} batchId=${dto.batchId}`);
    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    assertDeadlineAfterStart(startAt, deadlineAt);
    await this.assertBatchAndSubjectAllowed(businessId, dto.batchId, dto.subjectId, actor);

    const draftSubjectiveTest = await subjectiveTestRepo.insertDraftTest({
      ...pickDefined(dto, SUBJECTIVE_TEST_DTO_FIELDS),
      businessId,
      startAt,
      deadlineAt,
      status: TestStatus.DRAFT,
      createdBy: actor.id,
    });
    logger.info(
      `[subjective-test] draft test created subjectiveTestId=${draftSubjectiveTest.id} businessId=${businessId} userId=${actor.id}`,
    );
    return draftSubjectiveTest;
  }

  /** Marks, duration and dates are validated on create/update; publish only checks what can change after that. */
  async publishDraftTest(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] publishDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const draftSubjectiveTest = await this.findTestForStaff(businessId, subjectiveTestId, actor, { draftOnly: true });
    if (!draftSubjectiveTest.questionPaperPath) {
      logger.warn(`[subjective-test] publish blocked: no question paper subjectiveTestId=${subjectiveTestId}`);
      throw new BadRequestError('Upload the question paper before publishing');
    }
    if (draftSubjectiveTest.deadlineAt <= new Date()) {
      logger.warn(`[subjective-test] publish blocked: deadline passed subjectiveTestId=${subjectiveTestId}`);
      throw new BadRequestError('The deadline has already passed. Update it before publishing');
    }
    const publishedSubjectiveTest = await subjectiveTestRepo.updateTest(businessId, subjectiveTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: actor.id,
    });
    logger.info(`[subjective-test] test published subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return publishedSubjectiveTest;
  }

  async startOrResumeAttempt(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] startOrResumeAttempt subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const { subjectiveTest, ownAttempt } = await this.findPublishedTestForStudent(
      businessId,
      subjectiveTestId,
      actor,
      STUDENT_ATTEMPT_REQUIREMENT.NONE,
    );

    const toStartedAttemptResponse = (attempt: SubjectiveSubmissionRecord) => {
      this.assertAttemptStillOpen(subjectiveTest, attempt, actor);
      logger.info(`[subjective-test] attempt ready submissionId=${attempt.id} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return {
        submissionId: attempt.id,
        displayStatus: SubjectiveDisplayStatus.IN_PROGRESS,
        startedAt: attempt.startedAt,
        effectiveDeadlineAt: computeAttemptDeadline(subjectiveTest, attempt.startedAt),
      };
    };
    if (ownAttempt) return toStartedAttemptResponse(ownAttempt);

    const now = new Date();
    const availability = getTestAvailability(subjectiveTest, now);
    if (availability !== SubjectiveAvailability.OPEN) {
      logger.warn(`[subjective-test] start blocked subjectiveTestId=${subjectiveTestId} userId=${actor.id} availability=${availability}`);
      throw new BadRequestError(
        availability === SubjectiveAvailability.UPCOMING ? 'This test has not started yet' : 'The deadline for this test has passed',
      );
    }

    try {
      return toStartedAttemptResponse(await subjectiveTestRepo.insertInProgressAttempt(subjectiveTest.id, actor.id, now));
    } catch (error) {
      // A double click already created the attempt: resume that one instead.
      if (!hasPrismaErrorCode(error, PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION)) {
        logger.error(`[subjective-test] start failed subjectiveTestId=${subjectiveTestId} userId=${actor.id}: ${(error as Error).message}`);
        throw error;
      }
      logger.info(`[subjective-test] concurrent start resumed subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
      return toStartedAttemptResponse((await subjectiveTestRepo.findAttemptByTestAndStudent(subjectiveTest.id, actor.id))!);
    }
  }

  async submitAnswerSheet(openAttempt: StudentOpenAttemptContext, uploadedAnswerSheet: Express.Multer.File, actor: TestRequestActor) {
    const { subjectiveTest, ownAttempt: attempt } = openAttempt;
    logger.info(`[subjective-test] submitAnswerSheet submissionId=${attempt.id} userId=${actor.id}`);
    const submittedAt = new Date();
    const answerSheetPath = buildAnswerSheetStorageKey(subjectiveTest.businessId, subjectiveTest.id, actor.id, uploadedAnswerSheet);

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

  // PUT

  async updateDraftTest(businessId: number, subjectiveTestId: string, dto: UpdateSubjectiveTestDto, actor: TestRequestActor) {
    logger.info(`[subjective-test] updateDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const draftSubjectiveTest = await this.findTestForStaff(businessId, subjectiveTestId, actor, { draftOnly: true });
    const editedFields = pickDefined(dto, SUBJECTIVE_TEST_DTO_FIELDS);
    const editedSubjectiveTest = { ...draftSubjectiveTest, ...editedFields };
    const startAt = dto.startAt ? new Date(dto.startAt) : draftSubjectiveTest.startAt;
    const deadlineAt = dto.deadlineAt ? new Date(dto.deadlineAt) : draftSubjectiveTest.deadlineAt;
    assertDeadlineAfterStart(startAt, deadlineAt);

    if (dto.batchId !== undefined || dto.subjectId !== undefined) {
      await this.assertBatchAndSubjectAllowed(businessId, editedSubjectiveTest.batchId, editedSubjectiveTest.subjectId, actor);
    }

    const updatedSubjectiveTest = await subjectiveTestRepo.updateTest(businessId, subjectiveTestId, {
      ...editedFields,
      startAt,
      deadlineAt,
      updatedBy: actor.id,
    });
    logger.info(`[subjective-test] draft test updated subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    return updatedSubjectiveTest;
  }

  async replaceQuestionPaper(draftSubjectiveTest: SubjectiveTestRecord, uploadedFile: Express.Multer.File, actor: TestRequestActor) {
    const { id: subjectiveTestId, businessId } = draftSubjectiveTest;
    logger.info(`[subjective-test] replaceQuestionPaper subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    const questionPaperPath = buildQuestionPaperStorageKey(businessId, subjectiveTestId);
    const updatedSubjectiveTest = await uploadsFileStorage.saveUploadThenCommit({
      uploadedFile,
      storageKey: questionPaperPath,
      replacedStorageKey: draftSubjectiveTest.questionPaperPath,
      commitToDatabase: () => subjectiveTestRepo.updateTest(businessId, subjectiveTestId, { questionPaperPath, updatedBy: actor.id }),
    });
    logger.info(`[subjective-test] question paper saved subjectiveTestId=${subjectiveTestId} storageKey=${questionPaperPath}`);
    return updatedSubjectiveTest;
  }

  /** The checked copy is required on the first grade; later grades may change only marks and remarks. */
  async gradeSubmission(
    gradableSubmission: SubmissionContext,
    dto: GradeSubjectiveSubmissionDto,
    uploadedCheckedCopy: Express.Multer.File | undefined,
    actor: TestRequestActor,
  ) {
    const { subjectiveTest, submission } = gradableSubmission;
    logger.info(
      `[subjective-test] gradeSubmission submissionId=${submission.id} userId=${actor.id} hasNewCheckedCopy=${Boolean(uploadedCheckedCopy)}`,
    );
    if (dto.marksAwarded > subjectiveTest.totalMarks) {
      logger.warn(`[subjective-test] grade blocked: marks above total submissionId=${submission.id} marks=${dto.marksAwarded}`);
      throw new BadRequestError(`Marks cannot be more than ${subjectiveTest.totalMarks}`);
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
      const newCheckedCopyPath = buildCheckedCopyStorageKey(subjectiveTest.businessId, subjectiveTest.id, submission.id);
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
      `[subjective-test] submission graded submissionId=${submission.id} marks=${dto.marksAwarded}/${subjectiveTest.totalMarks} userId=${actor.id}`,
    );
    return SubjectiveTestMapper.toStaffSubmissionResponse(subjectiveTest, gradedSubmission, student, new Date());
  }

  // DELETE

  /** Students can only start published tests, so a draft never has submissions to protect. */
  async deleteDraftTest(businessId: number, subjectiveTestId: string, actor: TestRequestActor) {
    logger.info(`[subjective-test] deleteDraftTest businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
    await this.findTestForStaff(businessId, subjectiveTestId, actor, { draftOnly: true });
    await subjectiveTestRepo.deleteTest(businessId, subjectiveTestId);
    await uploadsFileStorage.deleteFolderIfExists(subjectiveTestStorageFolder(businessId, subjectiveTestId));
    logger.info(`[subjective-test] draft test deleted subjectiveTestId=${subjectiveTestId} userId=${actor.id}`);
  }
}

export const subjectiveTestService = new SubjectiveTestService();
