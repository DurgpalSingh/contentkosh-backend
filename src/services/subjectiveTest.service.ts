import { Prisma, UserRole } from '@prisma/client';
import { ApiError, BadRequestError, NotFoundError } from '../errors/api.errors';
import { HTTP_STATUS } from '../constants/httpStatus.constants';
import { PRISMA_ERROR_CODES } from '../constants/prismaErrorCodes.constants';
import {
  SubjectiveAvailability,
  SubjectiveDisplayStatus,
  SubjectiveSubmissionStatus,
  TestStatus,
} from '../constants/test-enums';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
import * as subjectiveRepo from '../repositories/subjectiveTest.repo';
import type { SubjectiveSubmissionRecord, SubjectiveTestRecord } from '../repositories/subjectiveTest.repo';
import * as userRepo from '../repositories/user.repo';
import {
  CreateSubjectiveTestDto,
  GradeSubjectiveSubmissionDto,
  UpdateSubjectiveTestDto,
} from '../dtos/subjectiveTest.dto';
import { SubjectiveTestMapper } from '../mappers/subjectiveTest.mapper';
import { privateFileService } from './privateFile.service';
import { hasPdfSignature } from '../utils/fileSignature.util';
import {
  assertBatchBelongsToBusiness,
  assertSubjectForBatch,
  assertTestBatchAccess,
} from '../utils/test.utils';
import { computeEffectiveEnd, deriveAvailability, deriveDisplayStatus } from '../utils/subjectiveTest.utils';
import logger from '../utils/logger';

type ActingUser = { id: number; role: UserRole };
type UploadedFile = Express.Multer.File | undefined;

/** What a controller needs to stream a private file. */
export type PrivateFileRef = { key: string; downloadName: string };

export type SubmissionListQuery = {
  status?: SubjectiveDisplayStatus;
  search?: string;
  page?: number;
  limit?: number;
};

const ENTITY_LABEL = 'Subjective test';

export class SubjectiveTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  /** Staff access: admins see every test in the business; teachers only tests they created. */
  private async getWithAccess(businessId: number, subjectiveTestId: string, user: ActingUser) {
    const test = await subjectiveRepo.findSubjectiveTestById(businessId, subjectiveTestId);
    if (!test || (!this.isElevated(user.role) && test.createdBy !== user.id)) {
      throw new NotFoundError(ENTITY_LABEL);
    }
    await assertTestBatchAccess({
      user,
      batchId: test.batchId,
      businessId,
      entityLabel: ENTITY_LABEL,
      entityId: subjectiveTestId,
    });
    return test;
  }

  private async getDraftWithAccess(businessId: number, subjectiveTestId: string, user: ActingUser) {
    const test = await this.getWithAccess(businessId, subjectiveTestId, user);
    if (test.status !== TestStatus.DRAFT) {
      throw new BadRequestError('A published test cannot be changed');
    }
    return test;
  }

  private async getPublishedForStudent(businessId: number, subjectiveTestId: string, user: ActingUser) {
    const test = await subjectiveRepo.findPublishedSubjectiveTestForStudent(businessId, subjectiveTestId, user.id);
    if (!test) throw new NotFoundError(ENTITY_LABEL);
    return test;
  }

  private async assertBatchAndSubject(
    businessId: number,
    batchId: number,
    subjectId: number | null | undefined,
    user: ActingUser,
    entityId: string,
  ) {
    await assertBatchBelongsToBusiness(businessId, batchId);
    await assertTestBatchAccess({ user, batchId, businessId, entityLabel: ENTITY_LABEL, entityId });
    if (subjectId !== undefined && subjectId !== null) {
      await assertSubjectForBatch({ batchId, subjectId, businessId, userId: user.id });
    }
  }

  private assertWindow(startAt: Date, deadlineAt: Date) {
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('Deadline must be after the start time');
    }
  }

  private async assertPdfUpload(file: Express.Multer.File) {
    if (!(await hasPdfSignature(file.path))) {
      throw new BadRequestError('The uploaded file is not a valid PDF');
    }
  }

  private testFolderKey(businessId: number, subjectiveTestId: string) {
    return privateFileService.buildKey(SUBJECTIVE_TEST_CONFIG.storagePrefix, businessId, subjectiveTestId);
  }

  /** A new, never-reused key so replacing a file never overwrites the previous version. */
  private newFileKey(businessId: number, subjectiveTestId: string, baseName: string | number, folder?: string) {
    const fileName = `${baseName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${SUBJECTIVE_TEST_CONFIG.pdfExtension}`;
    const testFolder = this.testFolderKey(businessId, subjectiveTestId);
    return folder
      ? privateFileService.buildKey(testFolder, folder, fileName)
      : privateFileService.buildKey(testFolder, fileName);
  }

  /**
   * Moves an already-validated upload into place and runs `persist`. If persisting fails the
   * new file is removed; the caller's previous file (if any) is only removed after success.
   */
  private async storeThenPersist<T>(
    file: Express.Multer.File,
    key: string,
    persist: () => Promise<T>,
    previousKey?: string | null,
  ): Promise<T> {
    await privateFileService.moveIntoPlace(file.path, key);
    let result: T;
    try {
      result = await persist();
    } catch (error) {
      await privateFileService.deleteQuietly(key);
      throw error;
    }
    if (previousKey && previousKey !== key) await privateFileService.deleteQuietly(previousKey);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Staff: manage tests
  // ---------------------------------------------------------------------------

  async create(businessId: number, dto: CreateSubjectiveTestDto, file: UploadedFile, user: ActingUser) {
    logger.info(`[subjective-test] create businessId=${businessId} userId=${user.id} batchId=${dto.batchId} hasPaper=${Boolean(file)}`);
    await this.assertBatchAndSubject(businessId, dto.batchId, dto.subjectId, user, 'create');
    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    this.assertWindow(startAt, deadlineAt);
    if (file) await this.assertPdfUpload(file);

    const created = await subjectiveRepo.createSubjectiveTest({
      businessId,
      batchId: dto.batchId,
      subjectId: dto.subjectId ?? null,
      name: dto.name.trim(),
      paperType: dto.paperType.trim(),
      description: dto.description ?? null,
      instructions: dto.instructions ?? null,
      totalMarks: dto.totalMarks,
      durationMinutes: dto.durationMinutes,
      startAt,
      deadlineAt,
      status: TestStatus.DRAFT,
      createdBy: user.id,
    });
    if (!file) return created;

    const key = this.newFileKey(businessId, created.id, 'question-paper');
    try {
      return await this.storeThenPersist(file, key, () =>
        subjectiveRepo.updateSubjectiveTest(businessId, created.id, { questionPaperPath: key }),
      );
    } catch (error) {
      // The draft was created only for this request; don't leave it behind without its paper.
      await subjectiveRepo.deleteSubjectiveTest(businessId, created.id);
      throw error;
    }
  }

  async list(
    businessId: number,
    query: { status?: number; batchId?: number; paperType?: string },
    user: ActingUser,
  ) {
    logger.info(`[subjective-test] list businessId=${businessId} userId=${user.id} role=${user.role}`);
    const where: Prisma.SubjectiveTestWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.batchId !== undefined ? { batchId: query.batchId } : {}),
      ...(query.paperType ? { paperType: query.paperType } : {}),
      ...(!this.isElevated(user.role) ? { createdBy: user.id } : {}),
    };
    return subjectiveRepo.findSubjectiveTestsByBusinessId(businessId, where);
  }

  async get(businessId: number, subjectiveTestId: string, user: ActingUser) {
    logger.info(`[subjective-test] get businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    const test = await this.getWithAccess(businessId, subjectiveTestId, user);
    const rows = await this.buildRoster(businessId, test);
    const submissionCounts = Object.fromEntries(
      Object.values(SubjectiveDisplayStatus).map((status) => [status, 0]),
    ) as Record<SubjectiveDisplayStatus, number>;
    for (const row of rows) submissionCounts[row.displayStatus] += 1;
    return { test, submissionCounts };
  }

  async update(
    businessId: number,
    subjectiveTestId: string,
    dto: UpdateSubjectiveTestDto,
    file: UploadedFile,
    user: ActingUser,
  ) {
    logger.info(`[subjective-test] update businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id} hasPaper=${Boolean(file)}`);
    const existing = await this.getDraftWithAccess(businessId, subjectiveTestId, user);
    if (file) await this.assertPdfUpload(file);

    if (dto.batchId !== undefined || dto.subjectId !== undefined) {
      const batchId = dto.batchId ?? existing.batchId;
      const subjectId = dto.subjectId !== undefined ? dto.subjectId : existing.subjectId;
      await this.assertBatchAndSubject(businessId, batchId, subjectId, user, subjectiveTestId);
    }

    const startAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const deadlineAt = dto.deadlineAt !== undefined ? new Date(dto.deadlineAt) : existing.deadlineAt;
    this.assertWindow(startAt, deadlineAt);

    const data: Prisma.SubjectiveTestUncheckedUpdateInput = {
      ...(dto.batchId !== undefined ? { batchId: dto.batchId } : {}),
      ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.paperType !== undefined ? { paperType: dto.paperType.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
      ...(dto.totalMarks !== undefined ? { totalMarks: dto.totalMarks } : {}),
      ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
      ...(dto.startAt !== undefined ? { startAt } : {}),
      ...(dto.deadlineAt !== undefined ? { deadlineAt } : {}),
      updatedBy: user.id,
    };

    if (!file) return subjectiveRepo.updateSubjectiveTest(businessId, subjectiveTestId, data);

    const key = this.newFileKey(businessId, subjectiveTestId, 'question-paper');
    return this.storeThenPersist(
      file,
      key,
      () => subjectiveRepo.updateSubjectiveTest(businessId, subjectiveTestId, { ...data, questionPaperPath: key }),
      existing.questionPaperPath,
    );
  }

  async publish(businessId: number, subjectiveTestId: string, user: ActingUser) {
    logger.info(`[subjective-test] publish businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    const existing = await this.getDraftWithAccess(businessId, subjectiveTestId, user);
    if (!existing.questionPaperPath) {
      throw new BadRequestError('Upload the question paper before publishing');
    }
    if (!(existing.totalMarks > 0)) throw new BadRequestError('Total marks must be greater than 0');
    if (!(existing.durationMinutes >= 1)) throw new BadRequestError('Duration must be at least 1 minute');
    this.assertWindow(existing.startAt, existing.deadlineAt);
    if (existing.deadlineAt <= new Date()) {
      throw new BadRequestError('The deadline has already passed. Update it before publishing');
    }
    return subjectiveRepo.updateSubjectiveTest(businessId, subjectiveTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: user.id,
    });
  }

  async remove(businessId: number, subjectiveTestId: string, user: ActingUser) {
    logger.info(`[subjective-test] remove businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    await this.getDraftWithAccess(businessId, subjectiveTestId, user);
    if ((await subjectiveRepo.countSubmissionsForTest(subjectiveTestId)) > 0) {
      throw new BadRequestError('A test with submissions cannot be deleted');
    }
    const result = await subjectiveRepo.deleteSubjectiveTest(businessId, subjectiveTestId);
    if (!result.count) throw new NotFoundError(ENTITY_LABEL);
    await privateFileService.deleteFolderQuietly(this.testFolderKey(businessId, subjectiveTestId));
  }

  async getQuestionPaperForStaff(businessId: number, subjectiveTestId: string, user: ActingUser): Promise<PrivateFileRef> {
    const test = await this.getWithAccess(businessId, subjectiveTestId, user);
    return this.questionPaperRef(test);
  }

  // ---------------------------------------------------------------------------
  // Staff: submissions and grading
  // ---------------------------------------------------------------------------

  private async buildRoster(businessId: number, test: SubjectiveTestRecord) {
    const now = new Date();
    const rows = await subjectiveRepo.findSubmissionRoster(businessId, test.id, test.batchId);
    return rows.map((row) => SubjectiveTestMapper.rosterRow(test, row, now));
  }

  async listSubmissions(businessId: number, subjectiveTestId: string, query: SubmissionListQuery, user: ActingUser) {
    logger.info(`[subjective-test] listSubmissions businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    const test = await this.getWithAccess(businessId, subjectiveTestId, user);
    const search = query.search?.trim().toLowerCase();
    const filtered = (await this.buildRoster(businessId, test)).filter(
      (row) =>
        (!query.status || row.displayStatus === query.status) &&
        (!search || row.studentName.toLowerCase().includes(search) || row.studentEmail.toLowerCase().includes(search)),
    );

    const limit = Math.min(query.limit ?? SUBJECTIVE_TEST_CONFIG.submissionsDefaultLimit, SUBJECTIVE_TEST_CONFIG.submissionsMaxLimit);
    const page = query.page ?? 1;
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  private async getSubmissionForStaff(
    businessId: number,
    subjectiveTestId: string,
    submissionId: string,
    user: ActingUser,
  ) {
    const test = await this.getWithAccess(businessId, subjectiveTestId, user);
    const submission = await subjectiveRepo.findSubmissionForTest(test.id, submissionId);
    if (!submission) throw new NotFoundError('Submission');
    return { test, submission };
  }

  private async toStaffSubmissionDetail(test: SubjectiveTestRecord, submission: SubjectiveSubmissionRecord) {
    const student = await userRepo.findBasicProfileById(submission.studentId);
    return SubjectiveTestMapper.staffSubmission(test, submission, student, new Date());
  }

  async getSubmissionDetailForStaff(businessId: number, subjectiveTestId: string, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getSubmissionForStaff(businessId, subjectiveTestId, submissionId, user);
    return this.toStaffSubmissionDetail(test, submission);
  }

  async getAnswerSheetForStaff(businessId: number, subjectiveTestId: string, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getSubmissionForStaff(businessId, subjectiveTestId, submissionId, user);
    return this.answerSheetRef(test, submission);
  }

  async getCheckedAnswerSheetForStaff(businessId: number, subjectiveTestId: string, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getSubmissionForStaff(businessId, subjectiveTestId, submissionId, user);
    return this.checkedAnswerSheetRef(test, submission);
  }

  async grade(
    businessId: number,
    subjectiveTestId: string,
    submissionId: string,
    dto: GradeSubjectiveSubmissionDto,
    file: UploadedFile,
    user: ActingUser,
  ) {
    logger.info(`[subjective-test] grade businessId=${businessId} subjectiveTestId=${subjectiveTestId} submissionId=${submissionId} userId=${user.id} hasFile=${Boolean(file)}`);
    const { test, submission } = await this.getSubmissionForStaff(businessId, subjectiveTestId, submissionId, user);

    if (submission.status === SubjectiveSubmissionStatus.IN_PROGRESS) {
      throw new BadRequestError('Only submitted answer sheets can be graded');
    }
    if (dto.marksAwarded > test.totalMarks) {
      throw new BadRequestError(`Marks cannot be more than ${test.totalMarks}`);
    }
    if (file) {
      await this.assertPdfUpload(file);
    } else if (!submission.checkedAnswerSheetPath) {
      throw new BadRequestError('Upload the checked answer sheet');
    }

    const previousKey = submission.checkedAnswerSheetPath;
    const persist = async (checkedAnswerSheetPath: string) => {
      const changed = await subjectiveRepo.updateSubmissionGrade(submission.id, previousKey, {
        marksAwarded: dto.marksAwarded,
        remarks: dto.remarks?.trim() || null,
        checkedAnswerSheetPath,
        checkedBy: user.id,
        checkedAt: new Date(),
      });
      if (!changed) {
        throw new ApiError('This submission was just updated by someone else. Refresh and try again', HTTP_STATUS.CONFLICT);
      }
    };

    if (file) {
      const key = this.newFileKey(businessId, test.id, submission.id, 'checked');
      await this.storeThenPersist(file, key, () => persist(key), previousKey);
    } else {
      await persist(previousKey!);
    }
    const graded = await subjectiveRepo.findSubmissionForTest(test.id, submission.id);
    if (!graded) throw new NotFoundError('Submission');
    return this.toStaffSubmissionDetail(test, graded);
  }

  // ---------------------------------------------------------------------------
  // Student
  // ---------------------------------------------------------------------------

  async listAvailable(businessId: number, user: ActingUser) {
    logger.info(`[subjective-test] listAvailable businessId=${businessId} userId=${user.id}`);
    const tests = await subjectiveRepo.findPublishedSubjectiveTestsForStudent(businessId, user.id);
    const submissions = await subjectiveRepo.findSubmissionsForStudent(user.id, tests.map((t) => t.id));
    const byTestId = new Map(submissions.map((s) => [s.subjectiveTestId, s]));
    const now = new Date();
    return tests.map((t) => SubjectiveTestMapper.availableTest(t, byTestId.get(t.id) ?? null, now));
  }

  /** Returns the attempt if it can still be worked on; otherwise explains why not. */
  private assertResumable(test: SubjectiveTestRecord, submission: SubjectiveSubmissionRecord, now: Date) {
    const status = deriveDisplayStatus(test, submission, now);
    if (status === SubjectiveDisplayStatus.EXPIRED) throw new BadRequestError('Your time for this test is over');
    if (status !== SubjectiveDisplayStatus.IN_PROGRESS) throw new BadRequestError('You have already submitted this test');
    return submission;
  }

  private toStartResult(test: SubjectiveTestRecord, submission: SubjectiveSubmissionRecord) {
    return {
      submissionId: submission.id,
      displayStatus: SubjectiveDisplayStatus.IN_PROGRESS,
      startedAt: submission.startedAt,
      effectiveDeadlineAt: computeEffectiveEnd(test, submission.startedAt),
    };
  }

  async start(businessId: number, subjectiveTestId: string, user: ActingUser) {
    logger.info(`[subjective-test] start businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    const test = await this.getPublishedForStudent(businessId, subjectiveTestId, user);
    const now = new Date();

    const existing = await subjectiveRepo.findSubmissionByTestAndStudent(test.id, user.id);
    if (existing) return this.toStartResult(test, this.assertResumable(test, existing, now));

    const availability = deriveAvailability(test, now);
    if (availability === SubjectiveAvailability.UPCOMING) throw new BadRequestError('This test has not started yet');
    if (availability === SubjectiveAvailability.CLOSED) throw new BadRequestError('The deadline for this test has passed');

    try {
      const created = await subjectiveRepo.createSubmission({
        subjectiveTestId: test.id,
        studentId: user.id,
        status: SubjectiveSubmissionStatus.IN_PROGRESS,
        startedAt: now,
      });
      return this.toStartResult(test, created);
    } catch (error) {
      // A concurrent start (double click) already created the row: resume it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT_VIOLATION) {
        const concurrent = await subjectiveRepo.findSubmissionByTestAndStudent(test.id, user.id);
        if (concurrent) return this.toStartResult(test, this.assertResumable(test, concurrent, now));
      }
      throw error;
    }
  }

  async getQuestionPaperForStudent(businessId: number, subjectiveTestId: string, user: ActingUser): Promise<PrivateFileRef> {
    const test = await this.getPublishedForStudent(businessId, subjectiveTestId, user);
    const submission = await subjectiveRepo.findSubmissionByTestAndStudent(test.id, user.id);
    if (!submission) throw new BadRequestError('Start the test to view the question paper');
    return this.questionPaperRef(test);
  }

  async submit(businessId: number, subjectiveTestId: string, file: UploadedFile, user: ActingUser) {
    logger.info(`[subjective-test] submit businessId=${businessId} subjectiveTestId=${subjectiveTestId} userId=${user.id}`);
    if (!file) throw new BadRequestError('Upload your answer sheet');
    const test = await this.getPublishedForStudent(businessId, subjectiveTestId, user);
    const submission = await subjectiveRepo.findSubmissionByTestAndStudent(test.id, user.id);
    if (!submission) throw new BadRequestError('Start the test before submitting');
    const now = new Date();
    this.assertResumable(test, submission, now);
    await this.assertPdfUpload(file);

    const key = this.newFileKey(businessId, test.id, user.id, 'answers');
    await this.storeThenPersist(file, key, async () => {
      const changed = await subjectiveRepo.markSubmissionSubmitted(submission.id, { answerSheetPath: key, submittedAt: now });
      if (!changed) throw new BadRequestError('You have already submitted this test');
    });
    return { submissionId: submission.id, displayStatus: SubjectiveDisplayStatus.SUBMITTED, submittedAt: now };
  }

  private async getOwnSubmission(businessId: number, submissionId: string, user: ActingUser) {
    const record = await subjectiveRepo.findStudentSubmissionWithTest(businessId, submissionId, user.id);
    if (!record) throw new NotFoundError('Submission');
    const { test, ...submission } = record;
    return { test, submission };
  }

  async getOwnSubmissionDetail(businessId: number, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getOwnSubmission(businessId, submissionId, user);
    return SubjectiveTestMapper.studentSubmission(test, submission, new Date());
  }

  async getOwnAnswerSheet(businessId: number, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getOwnSubmission(businessId, submissionId, user);
    return this.answerSheetRef(test, submission);
  }

  async getOwnCheckedAnswerSheet(businessId: number, submissionId: string, user: ActingUser) {
    const { test, submission } = await this.getOwnSubmission(businessId, submissionId, user);
    if (submission.status !== SubjectiveSubmissionStatus.CHECKED) throw new NotFoundError('Checked answer sheet');
    return this.checkedAnswerSheetRef(test, submission);
  }

  // ---------------------------------------------------------------------------
  // File refs
  // ---------------------------------------------------------------------------

  private questionPaperRef(test: SubjectiveTestRecord): PrivateFileRef {
    if (!test.questionPaperPath) throw new NotFoundError('Question paper');
    return { key: test.questionPaperPath, downloadName: `${test.name} - question paper.pdf` };
  }

  private answerSheetRef(test: SubjectiveTestRecord, submission: SubjectiveSubmissionRecord): PrivateFileRef {
    if (!submission.answerSheetPath) throw new NotFoundError('Answer sheet');
    return { key: submission.answerSheetPath, downloadName: `${test.name} - answer sheet.pdf` };
  }

  private checkedAnswerSheetRef(test: SubjectiveTestRecord, submission: SubjectiveSubmissionRecord): PrivateFileRef {
    if (!submission.checkedAnswerSheetPath) throw new NotFoundError('Checked answer sheet');
    return { key: submission.checkedAnswerSheetPath, downloadName: `${test.name} - checked copy.pdf` };
  }
}

export const subjectiveTestService = new SubjectiveTestService();
