import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as practiceRepo from '../repositories/practiceTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import { TestStatus } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreatePracticeTestDto, CreateQuestionDto, UpdatePracticeTestDto, UpdateQuestionDto } from '../dtos/test.dto';
import { UserRole } from '@prisma/client';
import { validateQuestionPayload, assertBatchBelongsToBusiness } from '../utils/test.utils';
import { TestMapper } from '../mappers/test.mapper';
import { assertTestBatchAccess } from '../utils/test.utils';
import { assertSubjectForBatch } from '../utils/testSubjectValidation';
import { sanitizeOptionalQuillHtml, sanitizeRequiredQuillHtml } from '../utils/sanitizeHtml';

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
    await assertTestBatchAccess({
      user,
      batchId: practiceTestRecord.batchId,
      businessId,
      entityLabel: 'Practice test',
      entityId: practiceTestId,
    });
    return practiceTestRecord;
  }

  async create(businessId: number, dto: CreatePracticeTestDto, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] create businessId=${businessId} userId=${user.id} batchId=${dto?.batchId} subjectId=${dto?.subjectId}`,
    );
    await assertBatchBelongsToBusiness(businessId, dto.batchId);
    await assertTestBatchAccess({
      user,
      batchId: dto.batchId,
      businessId,
      entityLabel: 'Practice test',
      entityId: 'create',
    });

    await assertSubjectForBatch({
      batchId: dto.batchId,
      subjectId: dto.subjectId,
      businessId,
      userId: user.id,
    });

    const createdPracticeTest = await practiceRepo.createPracticeTest({
      businessId,
      batchId: dto.batchId,
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
    return createdPracticeTest;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchId?: number } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    if (query.batchId !== undefined) {
      await assertTestBatchAccess({
        user,
        batchId: query.batchId,
        businessId,
        entityLabel: 'Practice test',
        entityId: 'list',
      });
    }
    if (!this.isElevated(user.role)) {
      const practiceTests = await practiceRepo.findPracticeTestsByBusinessIdForUser(businessId, user.id, { where });
      return practiceTests.map((practiceTest) => TestMapper.practiceTest(practiceTest));
    }
    const practiceTests = await practiceRepo.findPracticeTestsByBusinessId(businessId, { where });
    return practiceTests;
  }

  async get(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] get businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id} role=${user.role}`,
    );
    const practiceTestRecord = await this.getWithAccess(businessId, practiceTestId, user);
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

    const targetBatchId = dto.batchId !== undefined ? dto.batchId : existing.batchId;
    if (dto.batchId !== undefined) {
      await assertBatchBelongsToBusiness(businessId, dto.batchId);
      await assertTestBatchAccess({
        user,
        batchId: dto.batchId,
        businessId,
        entityLabel: 'Practice test',
        entityId: practiceTestId,
      });
    }

    const targetSubjectId = dto.subjectId ?? existing.subjectId;
    if (targetSubjectId !== null && targetSubjectId !== undefined) {
      await assertSubjectForBatch({
        batchId: targetBatchId,
        subjectId: targetSubjectId,
        businessId,
        userId: user.id,
      });
    }
    const updatedPracticeTest = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      ...(dto.batchId !== undefined ? { batchId: dto.batchId } : {}),
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
    return updatedPracticeTest;
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
    await assertBatchBelongsToBusiness(businessId, existing.batchId);
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
    return publishedPracticeTest;
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

    const sanitizedQuestionText = sanitizeRequiredQuillHtml(dto.questionText, 'questionText', {
      businessId,
      practiceTestId,
      userId: user.id,
    });
    const sanitizedExplanation = sanitizeOptionalQuillHtml(dto.explanation ?? null, 'explanation', {
      businessId,
      practiceTestId,
      userId: user.id,
    });

    const createdQuestion = await questionRepo.createPracticeTestQuestionResolvingCorrect(businessId, practiceTestId, {
      type: dto.type,
      text: sanitizedQuestionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: sanitizedExplanation,
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

    const sanitizedQuestionText =
      dto.questionText !== undefined
        ? sanitizeRequiredQuillHtml(dto.questionText, 'questionText', {
            businessId,
            practiceTestId,
            questionId,
            userId: user.id,
          })
        : undefined;
    const sanitizedExplanation =
      dto.explanation !== undefined
        ? sanitizeOptionalQuillHtml(dto.explanation ?? null, 'explanation', {
            businessId,
            practiceTestId,
            questionId,
            userId: user.id,
          })
        : undefined;

    const updatedQuestion = await questionRepo.updateQuestionAndOptions(businessId, questionId, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.questionText !== undefined ? { text: sanitizedQuestionText! } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: sanitizedExplanation! } : {}),
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
