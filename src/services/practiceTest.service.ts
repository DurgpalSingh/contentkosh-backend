import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as practiceRepo from '../repositories/practiceTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import * as subjectRepo from '../repositories/subject.repo';
import * as batchRepo from '../repositories/batch.repo';
import { TestStatus } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreatePracticeTestDto, CreateQuestionDto, UpdatePracticeTestDto, UpdateQuestionDto } from '../dtos/test.dto';
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
    logger.warn(`[practice-test] validateSubjectMatchesBatches subject not found subjectId=${subjectId}`);
    throw new BadRequestError('Subject not found');
  }
  const courseByBatch = await batchRepo.findBatchCourseIdsByBatchIds(batchIds);
  if (courseByBatch.size !== batchIds.length) {
    logger.warn(`[practice-test] validateSubjectMatchesBatches unknown batch in list subjectId=${subjectId}`);
    throw new BadRequestError('One or more batches not found');
  }
  for (const bid of batchIds) {
    const cid = courseByBatch.get(bid);
    if (cid !== subjectCourseId) {
      logger.warn(
        `[practice-test] validateSubjectMatchesBatches course mismatch subjectId=${subjectId} subjectCourseId=${subjectCourseId} batchId=${bid} batchCourseId=${cid}`,
      );
      throw new BadRequestError('Subject must belong to the same course as every assigned batch');
    }
  }
}

export class PracticeTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private async getWithAccess(
    businessId: number,
    practiceTestId: string,
    user: { id: number; role: UserRole },
  ) {
    const practiceTestRecord = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!practiceTestRecord) {
      throw new NotFoundError('Practice test not found');
    }
    await assertTestBatchOverlapForTeacherOrAdmin({
      user,
      testBatchIds: practiceTestRecord.batchIds ?? [],
      businessId,
      entityLabel: 'Practice test',
      entityId: practiceTestId,
    });
    return practiceTestRecord;
  }

  async create(businessId: number, dto: CreatePracticeTestDto, user: { id: number; role: UserRole }) {
    const batchIds = normalizeBatchIdList(dto.batchIds);
    logger.info(`[practice-test] create businessId=${businessId} userId=${user.id} batchIds=${batchIds.join(',')}`);
    if (!batchIds.length) throw new BadRequestError('At least one batch is required');

    for (const batchId of batchIds) {
      await assertBatchBelongsToBusiness(businessId, batchId);
    }
    await assertTestBatchAccessForAllBatches({
      user,
      batchIds,
      businessId,
      entityLabel: 'Practice test',
      entityId: 'create',
    });
    await validateSubjectMatchesBatches(dto.subjectId, batchIds);

    const createdPracticeTest = await practiceRepo.createPracticeTest({
      businessId,
      batchIds,
      subjectId: dto.subjectId,
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? TestStatus.DRAFT,
      defaultMarksPerQuestion: dto.defaultMarksPerQuestion ?? 1,
      showExplanations: dto.showExplanations ?? true,
      shuffleQuestions: dto.shuffleQuestions ?? true,
      shuffleOptions: dto.shuffleOptions ?? true,
      createdBy: user.id,
    });
    return attachPrimaryBatchDisplayName(createdPracticeTest);
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchIds?: { has: number } } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) {
      where.batchIds = { has: query.batchId };
      await assertTestBatchAccessForAllBatches({
        user,
        batchIds: [query.batchId],
        businessId,
        entityLabel: 'Practice test',
        entityId: 'list',
      });
    }
    const userBatchIds = !this.isElevated(user.role) ? await batchRepo.findActiveBatchIdsForUser(user.id) : [];
    const practiceTests = this.isElevated(user.role)
      ? await practiceRepo.findPracticeTestsByBusinessId(businessId, { where })
      : await practiceRepo.findPracticeTestsByBusinessIdForUser(businessId, userBatchIds, { where });
    const displayMap = await batchRepo.findBatchesDisplayByIds(collectBatchIdsFromTests(practiceTests));
    return practiceTests.map((t) => ({
      ...t,
      batchName: primaryBatchDisplayName(t.batchIds, displayMap),
    }));
  }

  async get(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] get businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id} role=${user.role}`,
    );
    const practiceTestRecord = await attachPrimaryBatchDisplayName(await this.getWithAccess(businessId, practiceTestId, user));
    const canSeeQuestions = this.isElevated(user.role) || user.role === UserRole.TEACHER;
    if (canSeeQuestions) {
      const questions = await questionRepo.listPracticeTestQuestions(businessId, practiceTestId);
      return { ...practiceTestRecord, questions } as typeof practiceTestRecord & { questions: typeof questions };
    }
    return practiceTestRecord as typeof practiceTestRecord & { questions?: undefined };
  }

  async update(
    businessId: number,
    practiceTestId: string,
    dto: UpdatePracticeTestDto,
    user: { id: number; role: UserRole },
  ) {
    logger.info(`[practice-test] update businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, practiceTestId, user);

    if (dto.batchIds !== undefined) {
      const next = normalizeBatchIdList(dto.batchIds);
      if (!next.length) throw new BadRequestError('At least one batch is required');
      if (existing.status !== TestStatus.DRAFT) {
        logger.warn(`[practice-test] update batchIds rejected: not draft practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Batches can only be changed while the test is in draft');
      }
      const attemptCount = await practiceRepo.countPracticeTestAttempts(practiceTestId);
      if (attemptCount > 0) {
        logger.warn(`[practice-test] update batchIds rejected: has attempts practiceTestId=${practiceTestId}`);
        throw new BadRequestError('Cannot change batches after attempts exist');
      }
      for (const batchId of next) {
        await assertBatchBelongsToBusiness(businessId, batchId);
      }
      await assertTestBatchAccessForAllBatches({
        user,
        batchIds: next,
        businessId,
        entityLabel: 'Practice test',
        entityId: practiceTestId,
      });
      const subjectId = dto.subjectId ?? existing.subjectId;
      await validateSubjectMatchesBatches(subjectId, next);
    }

    if (dto.subjectId !== undefined && dto.batchIds === undefined) {
      await validateSubjectMatchesBatches(dto.subjectId, existing.batchIds);
    }

    const updatedPracticeTest = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      ...(dto.batchIds !== undefined ? { batchIds: normalizeBatchIdList(dto.batchIds) } : {}),
      ...(dto.subjectId !== undefined ? { subjectId: dto.subjectId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.defaultMarksPerQuestion !== undefined ? { defaultMarksPerQuestion: dto.defaultMarksPerQuestion } : {}),
      ...(dto.showExplanations !== undefined ? { showExplanations: dto.showExplanations } : {}),
      ...(dto.shuffleQuestions !== undefined ? { shuffleQuestions: dto.shuffleQuestions } : {}),
      ...(dto.shuffleOptions !== undefined ? { shuffleOptions: dto.shuffleOptions } : {}),
      updatedBy: user.id,
    });
    if (!updatedPracticeTest) throw new NotFoundError('Practice test not found');
    return attachPrimaryBatchDisplayName(updatedPracticeTest);
  }

  async remove(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] remove businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    await this.getWithAccess(businessId, practiceTestId, user);
    const deleteResult = await practiceRepo.deletePracticeTest(businessId, practiceTestId);
    if (!deleteResult.count) throw new NotFoundError('Practice test not found');
    return;
  }

  async publish(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] publish businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, practiceTestId, user);
    for (const batchId of existing.batchIds) {
      await assertBatchBelongsToBusiness(businessId, batchId);
    }
    if (existing.status !== TestStatus.DRAFT) {
      throw new BadRequestError('Only draft tests can be published');
    }
    const questionCount = await questionRepo.countQuestionsForPracticeTest(businessId, practiceTestId);
    if (questionCount < 1) {
      throw new BadRequestError('Add at least one question before publishing');
    }
    const publishedPracticeTest = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: user.id,
    });
    if (!publishedPracticeTest) throw new NotFoundError('Practice test not found');
    return attachPrimaryBatchDisplayName(publishedPracticeTest);
  }

  async listQuestions(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] listQuestions businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    await this.getWithAccess(businessId, practiceTestId, user);
    return questionRepo.listPracticeTestQuestions(businessId, practiceTestId);
  }

  async createQuestion(
    businessId: number,
    practiceTestId: string,
    dto: CreateQuestionDto,
    user: { id: number; role: UserRole },
  ) {
    logger.info(
      `[practice-test] createQuestion businessId=${businessId} practiceTestId=${practiceTestId} type=${dto?.type} userId=${user.id}`,
    );
    await this.getWithAccess(businessId, practiceTestId, user);
    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const safeText = sanitizeQuestionHtml(dto.questionText);
    const safeExplanation = sanitizeOptionalQuestionHtml(dto.explanation);

    const createdQuestion = await questionRepo.createPracticeTestQuestionResolvingCorrect(businessId, practiceTestId, {
      type: dto.type,
      text: safeText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: safeExplanation,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionRefs: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    if (!createdQuestion) throw new NotFoundError('Practice test not found');
    return createdQuestion;
  }

  async updateQuestion(businessId: number, questionId: string, dto: UpdateQuestionDto, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const practiceTestId = existing.practiceTestId;
    if (!practiceTestId) throw new BadRequestError('Question does not belong to a practice test');
    await this.getWithAccess(businessId, practiceTestId, user);

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
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
    const practiceTestId = existing.practiceTestId;
    if (!practiceTestId) throw new BadRequestError('Question does not belong to a practice test');
    await this.getWithAccess(businessId, practiceTestId, user);

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}


export const practiceTestService = new PracticeTestService();
