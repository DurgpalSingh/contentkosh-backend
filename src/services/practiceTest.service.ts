import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as practiceRepo from '../repositories/practiceTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import { TestStatus } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreatePracticeTestDto, CreateQuestionDto, UpdatePracticeTestDto, UpdateQuestionDto } from '../dtos/test.dto';
import { UserRole } from '@prisma/client';
import { validateQuestionPayload, assertTeacherInBatch, assertBatchBelongsToBusiness } from '../utils/test.utils';
import { TestMapper } from '../mappers/test.mapper';

export class PracticeTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private async getWithAccess(
    businessId: number,
    practiceTestId: string,
    user: { id: number; role: UserRole },
  ) {
    const practiceTestRecord =
      this.isElevated(user.role)
        ? await practiceRepo.findPracticeTestById(businessId, practiceTestId)
        : await practiceRepo.findPracticeTestByIdForUser(businessId, practiceTestId, user.id);
    if (!practiceTestRecord) {
      throw new NotFoundError('Practice test not found');
    }
    return practiceTestRecord;
  }

  async create(businessId: number, dto: CreatePracticeTestDto, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] create businessId=${businessId} userId=${user.id} batchId=${dto?.batchId}`);
    await assertBatchBelongsToBusiness(businessId, dto.batchId);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, dto.batchId);
    }
    const createdPracticeTest = await practiceRepo.createPracticeTest({
      businessId,
      batchId: dto.batchId,
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
    if (!this.isElevated(user.role)) {
      const practiceTests = await practiceRepo.findPracticeTestsByBusinessIdForUser(businessId, user.id, { where });
      return practiceTests.map((practiceTest) => TestMapper.practiceTest(practiceTest));
    }
    const practiceTests = await practiceRepo.findPracticeTestsByBusinessId(businessId, { where });
    return practiceTests.map((practiceTest) => TestMapper.practiceTest(practiceTest));
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
    if (user.role === UserRole.TEACHER) {
      const exists = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
      if (exists) {
        await assertTeacherInBatch(user.id, exists.batchId); // throws ForbiddenError (403) if not in batch
      }
      // If !exists, fall through — getWithAccess will throw 404
    }
    const existing = await this.getWithAccess(businessId, practiceTestId, user);
    if (dto.batchId !== undefined) {
      await assertBatchBelongsToBusiness(businessId, dto.batchId);
      if (user.role === UserRole.TEACHER) {
        await assertTeacherInBatch(user.id, dto.batchId);
      }
    }
    const updatedPracticeTest = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      ...(dto.batchId !== undefined ? { batchId: dto.batchId } : {}),
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
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, updatedPracticeTest.batchId);
    }
    return updatedPracticeTest;
  }

  async remove(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] remove businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    if (user.role === UserRole.TEACHER) {
      const exists = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
      if (exists) {
        await assertTeacherInBatch(user.id, exists.batchId); // throws ForbiddenError (403) if not in batch
      }
      // If !exists, fall through — getWithAccess will throw 404
    }
    const existing = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, existing.batchId);
    }
    const deleteResult = await practiceRepo.deletePracticeTest(businessId, practiceTestId);
    if (!deleteResult.count) throw new NotFoundError('Practice test not found');
    return;
  }

  async publish(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] publish businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, practiceTestId, user);
    await assertBatchBelongsToBusiness(businessId, existing.batchId);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, existing.batchId);
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
    return publishedPracticeTest;
  }

  async listQuestions(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] listQuestions businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    const practiceTestRecord = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, practiceTestRecord.batchId);
    }
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
    const practiceTestRecord = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, practiceTestRecord.batchId);
    }
    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const createdQuestion = await questionRepo.createPracticeTestQuestionResolvingCorrect(businessId, practiceTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
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
    const practiceTestRecord = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, practiceTestRecord.batchId);
    }

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

    const updatedQuestion = await questionRepo.updateQuestionAndOptions(businessId, questionId, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.questionText !== undefined ? { text: dto.questionText } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
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
    const practiceTestRecord = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, practiceTestRecord.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}


export const practiceTestService = new PracticeTestService();
