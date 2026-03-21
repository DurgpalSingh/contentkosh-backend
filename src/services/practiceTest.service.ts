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
    const t =
      this.isElevated(user.role)
        ? await practiceRepo.findPracticeTestById(businessId, practiceTestId)
        : await practiceRepo.findPracticeTestByIdForUser(businessId, practiceTestId, user.id);
    if (!t) {
      throw new NotFoundError('Practice test not found');
    }
    return t;
  }

  async create(businessId: number, dto: CreatePracticeTestDto, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] create businessId=${businessId} userId=${user.id} batchId=${dto?.batchId}`);
    await assertBatchBelongsToBusiness(businessId, dto.batchId);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, dto.batchId);
    }
    const created = await practiceRepo.createPracticeTest({
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
    return created;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchId?: number } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    if (!this.isElevated(user.role)) {
      const raw = await practiceRepo.findPracticeTestsByBusinessIdForUser(businessId, user.id, { where });
      return raw.map((t) => TestMapper.practiceTest(t));
    }
    const raw = await practiceRepo.findPracticeTestsByBusinessId(businessId, { where });
    return raw.map((t) => TestMapper.practiceTest(t));
  }

  async get(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(
      `[practice-test] get businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id} role=${user.role}`,
    );
    const raw = await this.getWithAccess(businessId, practiceTestId, user);
    const canSeeQuestions = this.isElevated(user.role) || user.role === UserRole.TEACHER;
    if (canSeeQuestions) {
      const questions = await questionRepo.listPracticeTestQuestions(businessId, practiceTestId);
      return { ...raw, questions } as typeof raw & { questions: typeof questions };
    }
    return raw as typeof raw & { questions?: undefined };
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
    const updated = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
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
    if (!updated) throw new NotFoundError('Practice test not found');
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, updated.batchId);
    }
    return updated;
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
    const r = await practiceRepo.deletePracticeTest(businessId, practiceTestId);
    if (!r.count) throw new NotFoundError('Practice test not found');
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
    const updated = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: user.id,
    });
    if (!updated) throw new NotFoundError('Practice test not found');
    return updated;
  }

  async listQuestions(businessId: number, practiceTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[practice-test] listQuestions businessId=${businessId} practiceTestId=${practiceTestId} userId=${user.id}`);
    const test = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, test.batchId);
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
    const test = await this.getWithAccess(businessId, practiceTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, test.batchId);
    }
    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const created = await questionRepo.createPracticeTestQuestionResolvingCorrect(businessId, practiceTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionRefs: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    if (!created) throw new NotFoundError('Practice test not found');
    return created;
  }

  async updateQuestion(businessId: number, questionId: string, dto: UpdateQuestionDto, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const testId = existing.practiceTestId;
    if (!testId) throw new BadRequestError('Question does not belong to a practice test');
    const test = await this.getWithAccess(businessId, testId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, test.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    const newType = dto.type ?? existing.type;
    const optionPayload = dto.options !== undefined
      ? dto.options.map((o) => ({
          ...(o.id !== undefined ? { id: o.id } : {}),
          text: o.text,
          mediaUrl: o.mediaUrl ?? null,
        }))
      : undefined;
    const correctOptionIdsAnswersRaw = dto.correctOptionIdsAnswers ?? existing.correctOptionIdsAnswers ?? [];
    const correctOptionIdsAnswers = correctOptionIdsAnswersRaw.map((v) => String(v));
    const correctTextAnswer = dto.correctTextAnswer ?? existing.correctTextAnswer ?? null;

    validateQuestionPayload({
      type: newType,
      correctTextAnswer,
      correctOptionIdsAnswers,
      options:
        optionPayload?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ??
        existing.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ??
        [],
    });

    const updated = await questionRepo.updateQuestionAndOptions(businessId, questionId, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.questionText !== undefined ? { text: dto.questionText } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
      ...(dto.correctTextAnswer !== undefined ? { correctTextAnswer: dto.correctTextAnswer } : {}),
      ...(dto.correctOptionIdsAnswers !== undefined ? { correctOptionIdsAnswers } : {}),
      ...(dto.options !== undefined ? { options: optionPayload ?? [] } : {}),
    });
    if (!updated) throw new NotFoundError('Question not found');
    return updated;
  }

  async deleteQuestion(businessId: number, questionId: string, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');
    const testId = existing.practiceTestId;
    if (!testId) throw new BadRequestError('Question does not belong to a practice test');
    const test = await this.getWithAccess(businessId, testId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, test.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}


export const practiceTestService = new PracticeTestService();
