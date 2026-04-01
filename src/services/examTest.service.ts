import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as examRepo from '../repositories/examTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import * as subjectRepo from '../repositories/subject.repo';
import * as batchRepo from '../repositories/batch.repo';
import { TestStatus, ResultVisibilityExam } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreateExamTestDto, CreateQuestionDto, UpdateExamTestDto, UpdateQuestionDto } from '../dtos/test.dto';
import { UserRole } from '@prisma/client';
import {
  validateQuestionPayload,
  assertBatchBelongsToBusiness,
  assertTestBatchAccessForAllBatches,
  assertTestBatchOverlapForTeacherOrAdmin,
} from '../utils/test.utils';
import { primaryBatchDisplayName } from '../mappers/test.mapper';
import { sanitizeOptionalQuestionHtml, sanitizeQuestionHtml } from '../utils/sanitizeHtml';
import { attachPrimaryBatchDisplayName, collectBatchIdsFromTests } from '../utils/testBatchDisplay';

function normalizeBatchIdList(batchIds: number[]): number[] {
  const unique = [...new Set(batchIds.filter((n) => Number.isInteger(n) && n >= 1))];
  unique.sort((a, b) => a - b);
  return unique;
}

async function validateSubjectMatchesBatches(subjectId: number, batchIds: number[]): Promise<void> {
  const subjectCourseId = await subjectRepo.findSubjectCourseId(subjectId);
  if (subjectCourseId === null) {
    logger.warn(`[exam-test] validateSubjectMatchesBatches subject not found subjectId=${subjectId}`);
    throw new BadRequestError('Subject not found');
  }
  const courseByBatch = await batchRepo.findBatchCourseIdsByBatchIds(batchIds);
  if (courseByBatch.size !== batchIds.length) {
    logger.warn(`[exam-test] validateSubjectMatchesBatches unknown batch subjectId=${subjectId}`);
    throw new BadRequestError('One or more batches not found');
  }
  for (const bid of batchIds) {
    const cid = courseByBatch.get(bid);
    if (cid !== subjectCourseId) {
      logger.warn(
        `[exam-test] validateSubjectMatchesBatches course mismatch subjectId=${subjectId} subjectCourseId=${subjectCourseId} batchId=${bid} batchCourseId=${cid}`,
      );
      throw new BadRequestError('Subject must belong to the same course as every assigned batch');
    }
  }
}

export class ExamTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private async getWithAccess(
    businessId: number,
    examTestId: string,
    user: { id: number; role: UserRole },
  ) {
    const examTestRecord = await examRepo.findExamTestById(businessId, examTestId);
    if (!examTestRecord) {
      throw new NotFoundError('Exam test not found');
    }
    await assertTestBatchOverlapForTeacherOrAdmin({
      user,
      testBatchIds: examTestRecord.batchIds ?? [],
      businessId,
      entityLabel: 'Exam test',
      entityId: examTestId,
    });
    return examTestRecord;
  }

  async create(businessId: number, dto: CreateExamTestDto, user: { id: number; role: UserRole }) {
    const batchIds = normalizeBatchIdList(dto.batchIds);
    logger.info(`[exam-test] create businessId=${businessId} userId=${user.id} batchIds=${batchIds.join(',')}`);
    if (!batchIds.length) throw new BadRequestError('At least one batch is required');

    for (const batchId of batchIds) {
      await assertBatchBelongsToBusiness(businessId, batchId);
    }
    await assertTestBatchAccessForAllBatches({
      user,
      batchIds,
      businessId,
      entityLabel: 'Exam test',
      entityId: 'create',
    });
    await validateSubjectMatchesBatches(dto.subjectId, batchIds);

    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const createdExamTest = await examRepo.createExamTest({
      businessId,
      batchIds,
      subjectId: dto.subjectId,
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? TestStatus.DRAFT,
      startAt,
      deadlineAt,
      durationMinutes: dto.durationMinutes,
      defaultMarksPerQuestion: dto.defaultMarksPerQuestion ?? 1,
      negativeMarksPerQuestion: dto.negativeMarksPerQuestion ?? 0,
      resultVisibility: dto.resultVisibility ?? ResultVisibilityExam.AFTER_DEADLINE,
      shuffleQuestions: dto.shuffleQuestions ?? true,
      shuffleOptions: dto.shuffleOptions ?? true,
      createdBy: user.id,
    });
    return attachPrimaryBatchDisplayName(createdExamTest);
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[exam-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchIds?: { has: number } } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) {
      where.batchIds = { has: query.batchId };
      await assertTestBatchAccessForAllBatches({
        user,
        batchIds: [query.batchId],
        businessId,
        entityLabel: 'Exam test',
        entityId: 'list',
      });
    }
    const userBatchIds = !this.isElevated(user.role) ? await batchRepo.findActiveBatchIdsForUser(user.id) : [];
    const examTests = this.isElevated(user.role)
      ? await examRepo.findExamTestsByBusinessId(businessId, { where })
      : await examRepo.findExamTestsByBusinessIdForUser(businessId, userBatchIds, { where });
    const displayMap = await batchRepo.findBatchesDisplayByIds(collectBatchIdsFromTests(examTests));
    return examTests.map((t) => ({
      ...t,
      batchName: primaryBatchDisplayName(t.batchIds, displayMap),
    }));
  }

  async get(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] get businessId=${businessId} examTestId=${examTestId} userId=${user.id} role=${user.role}`);
    const examTestRecord = await attachPrimaryBatchDisplayName(await this.getWithAccess(businessId, examTestId, user));
    const canSeeQuestions = this.isElevated(user.role) || user.role === UserRole.TEACHER;
    if (canSeeQuestions) {
      const questions = await questionRepo.listExamTestQuestions(businessId, examTestId);
      return { ...examTestRecord, questions } as typeof examTestRecord & { questions: typeof questions };
    }
    return examTestRecord as typeof examTestRecord & { questions?: undefined };
  }

  async update(
    businessId: number,
    examTestId: string,
    dto: UpdateExamTestDto,
    user: { id: number; role: UserRole },
  ) {
    logger.info(`[exam-test] update businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);

    if (dto.batchIds !== undefined) {
      const next = normalizeBatchIdList(dto.batchIds);
      if (!next.length) throw new BadRequestError('At least one batch is required');
      if (existing.status !== TestStatus.DRAFT) {
        logger.warn(`[exam-test] update batchIds rejected: not draft examTestId=${examTestId}`);
        throw new BadRequestError('Batches can only be changed while the test is in draft');
      }
      const attemptCount = await examRepo.countExamTestAttempts(examTestId);
      if (attemptCount > 0) {
        logger.warn(`[exam-test] update batchIds rejected: has attempts examTestId=${examTestId}`);
        throw new BadRequestError('Cannot change batches after attempts exist');
      }
      for (const batchId of next) {
        await assertBatchBelongsToBusiness(businessId, batchId);
      }
      await assertTestBatchAccessForAllBatches({
        user,
        batchIds: next,
        businessId,
        entityLabel: 'Exam test',
        entityId: examTestId,
      });
      const subjectId = dto.subjectId ?? existing.subjectId;
      await validateSubjectMatchesBatches(subjectId, next);
    }

    if (dto.subjectId !== undefined && dto.batchIds === undefined) {
      await validateSubjectMatchesBatches(dto.subjectId, existing.batchIds);
    }

    const startAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const deadlineAt = dto.deadlineAt !== undefined ? new Date(dto.deadlineAt) : existing.deadlineAt;
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const updatedExamTest = await examRepo.updateExamTest(businessId, examTestId, {
      ...(dto.batchIds !== undefined ? { batchIds: normalizeBatchIdList(dto.batchIds) } : {}),
      ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt) } : {}),
      ...(dto.deadlineAt !== undefined ? { deadlineAt: new Date(dto.deadlineAt) } : {}),
      ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
      ...(dto.defaultMarksPerQuestion !== undefined ? { defaultMarksPerQuestion: dto.defaultMarksPerQuestion } : {}),
      ...(dto.negativeMarksPerQuestion !== undefined ? { negativeMarksPerQuestion: dto.negativeMarksPerQuestion } : {}),
      ...(dto.resultVisibility !== undefined ? { resultVisibility: dto.resultVisibility } : {}),
      ...(dto.shuffleQuestions !== undefined ? { shuffleQuestions: dto.shuffleQuestions } : {}),
      ...(dto.shuffleOptions !== undefined ? { shuffleOptions: dto.shuffleOptions } : {}),
      updatedBy: user.id,
    });
    if (!updatedExamTest) throw new NotFoundError('Exam test not found');
    return attachPrimaryBatchDisplayName(updatedExamTest);
  }

  async remove(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] remove businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    await this.getWithAccess(businessId, examTestId, user);
    const deleteResult = await examRepo.deleteExamTest(businessId, examTestId);
    if (!deleteResult.count) throw new NotFoundError('Exam test not found');
    return;
  }

  async publish(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] publish businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);
    for (const batchId of existing.batchIds) {
      await assertBatchBelongsToBusiness(businessId, batchId);
    }
    if (existing.status !== TestStatus.DRAFT) {
      throw new BadRequestError('Only draft tests can be published');
    }
    if (!(existing.deadlineAt > existing.startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }
    if (!existing.durationMinutes || existing.durationMinutes < 1) {
      throw new BadRequestError('durationMinutes must be at least 1');
    }
    const questionCount = await questionRepo.countQuestionsForExamTest(businessId, examTestId);
    if (questionCount < 1) {
      throw new BadRequestError('Add at least one question before publishing');
    }
    const publishedExamTest = await examRepo.updateExamTest(businessId, examTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: user.id,
    });
    if (!publishedExamTest) throw new NotFoundError('Exam test not found');
    return attachPrimaryBatchDisplayName(publishedExamTest);
  }

  async listQuestions(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] listQuestions businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    await this.getWithAccess(businessId, examTestId, user);
    return questionRepo.listExamTestQuestions(businessId, examTestId);
  }

  async createQuestion(
    businessId: number,
    examTestId: string,
    dto: CreateQuestionDto,
    user: { id: number; role: UserRole },
  ) {
    logger.info(
      `[exam-test] createQuestion businessId=${businessId} examTestId=${examTestId} type=${dto?.type} userId=${user.id}`,
    );
    await this.getWithAccess(businessId, examTestId, user);
    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const safeText = sanitizeQuestionHtml(dto.questionText);
    const safeExplanation = sanitizeOptionalQuestionHtml(dto.explanation);

    const createdQuestion = await questionRepo.createExamTestQuestionResolvingCorrect(businessId, examTestId, {
      type: dto.type,
      text: safeText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: safeExplanation,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionRefs: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });
    if (!createdQuestion) throw new NotFoundError('Exam test not found');
    return createdQuestion;
  }

  async updateQuestion(businessId: number, questionId: string, dto: UpdateQuestionDto, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const examTestId = existing.examTestId;
    if (!examTestId) throw new BadRequestError('Question does not belong to an exam test');
    await this.getWithAccess(businessId, examTestId, user);

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    const resolvedQuestionType = dto.type ?? existing.type;
    const optionUpdates = dto.options !== undefined
      ? dto.options.map((o) => ({
          ...(o.id !== undefined ? { id: o.id } : {}),
          text: o.text,
          mediaUrl: o.mediaUrl ?? null,
        }))
      : undefined;
    const correctOptionIdsForValidation = dto.correctOptionIdsAnswers ?? existing.correctOptionIdsAnswers ?? [];
    const resolvedCorrectTextAnswer = dto.correctTextAnswer ?? existing.correctTextAnswer ?? null;

    validateQuestionPayload({
      type: resolvedQuestionType,
      correctTextAnswer: resolvedCorrectTextAnswer,
      correctOptionIdsAnswers: correctOptionIdsForValidation.map((v) => String(v)),
      options:
        optionUpdates?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ??
        existing.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ??
        [],
    });

    const safeText = dto.questionText !== undefined ? sanitizeQuestionHtml(dto.questionText) : undefined;
    const safeExplanation: string | null | undefined =
      dto.explanation !== undefined ? sanitizeOptionalQuestionHtml(dto.explanation) : undefined;

    const updatedQuestion = await questionRepo.updateQuestionAndOptions(businessId, questionId, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(safeText !== undefined ? { text: safeText } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: safeExplanation ?? null } : {}),
      ...(dto.correctTextAnswer !== undefined ? { correctTextAnswer: dto.correctTextAnswer } : {}),
      ...(dto.correctOptionIdsAnswers !== undefined
        ? { correctOptionRefs: dto.correctOptionIdsAnswers }
        : {}),
      ...(dto.options !== undefined ? { options: optionUpdates ?? [] } : {}),
    });
    if (!updatedQuestion) throw new NotFoundError('Question not found');
    return updatedQuestion;
  }

  async deleteQuestion(businessId: number, questionId: string, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');
    const examTestId = existing.examTestId;
    if (!examTestId) throw new BadRequestError('Question does not belong to an exam test');
    await this.getWithAccess(businessId, examTestId, user);

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}


export const examTestService = new ExamTestService();
