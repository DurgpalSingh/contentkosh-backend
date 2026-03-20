import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as examRepo from '../repositories/exam-test.repo';
import * as questionRepo from '../repositories/test-question.repo';
import * as batchRepo from '../repositories/batch.repo';
import { TestStatus, QuestionType, ResultVisibilityExam } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreateExamTestDto, CreateQuestionDto, UpdateExamTestDto, UpdateQuestionDto } from '../dtos/test.dto';
import { UserRole } from '@prisma/client';

export class ExamTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private async assertTeacherInBatch(userId: number, batchId: number) {
    const ok = await batchRepo.isActiveUserInBatch(userId, batchId);
    if (!ok) {
      logger.warn(`[exam-test] teacher not in batch userId=${userId} batchId=${batchId}`);
      throw new NotFoundError('Exam test not found');
    }
  }

  private async assertBatchBelongsToBusiness(businessId: number, batchId: number) {
    const batchBusinessId = await batchRepo.findBatchBusinessId(batchId);
    if (!batchBusinessId) {
      logger.warn(`[exam-test] invalid batchId=${batchId} businessId=${businessId}`);
      throw new BadRequestError('Batch not found');
    }
    if (batchBusinessId !== businessId) {
      logger.warn(`[exam-test] batch business mismatch businessId=${businessId} batchId=${batchId} batchBusinessId=${batchBusinessId}`);
      throw new BadRequestError('Batch does not belong to this business');
    }
  }

  private async getWithAccess(
    businessId: number,
    examTestId: string,
    user: { id: number; role: UserRole },
  ) {
    const t =
      this.isElevated(user.role)
        ? await examRepo.findExamTestById(businessId, examTestId)
        : await examRepo.findExamTestByIdForUser(businessId, examTestId, user.id);
    if (!t) throw new NotFoundError('Exam test not found');
    return t;
  }

  async create(businessId: number, dto: CreateExamTestDto, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] create businessId=${businessId} userId=${user.id} batchId=${dto?.batchId}`);
    await this.assertBatchBelongsToBusiness(businessId, dto.batchId);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, dto.batchId);
    }
    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const created = await examRepo.createExamTest({
      businessId,
      batchId: dto.batchId,
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
    return created;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[exam-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchId?: number } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    if (!this.isElevated(user.role)) {
      return examRepo.findExamTestsByBusinessIdForUser(businessId, user.id, { where });
    }
    return examRepo.findExamTestsByBusinessId(businessId, { where });
  }

  async get(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] get businessId=${businessId} examTestId=${examTestId} userId=${user.id} role=${user.role}`);
    return this.getWithAccess(businessId, examTestId, user);
  }

  async update(
    businessId: number,
    examTestId: string,
    dto: UpdateExamTestDto,
    user: { id: number; role: UserRole },
  ) {
    logger.info(`[exam-test] update businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);

    if (dto.batchId !== undefined) {
      await this.assertBatchBelongsToBusiness(businessId, dto.batchId);
      if (user.role === UserRole.TEACHER) {
        await this.assertTeacherInBatch(user.id, dto.batchId);
      }
    }

    const startAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const deadlineAt = dto.deadlineAt !== undefined ? new Date(dto.deadlineAt) : existing.deadlineAt;
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const updated = await examRepo.updateExamTest(businessId, examTestId, {
      ...(dto.batchId !== undefined ? { batchId: dto.batchId } : {}),
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
    if (!updated) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, updated.batchId);
    }
    return updated;
  }

  async remove(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] remove businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, existing.batchId);
    }
    const r = await examRepo.deleteExamTest(businessId, examTestId);
    if (!r.count) throw new NotFoundError('Exam test not found');
    return;
  }

  async publish(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] publish businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);
    await this.assertBatchBelongsToBusiness(businessId, existing.batchId);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, existing.batchId);
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
    const updated = await examRepo.updateExamTest(businessId, examTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: user.id,
    });
    if (!updated) throw new NotFoundError('Exam test not found');
    return updated;
  }

  async listQuestions(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] listQuestions businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const test = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, test.batchId);
    }
    return questionRepo.listExamTestQuestions(businessId, examTestId);
  }

  private validateQuestionPayload(payload: {
    type: number;
    correctTextAnswer?: string | null;
    correctOptionIdsAnswers?: Array<string | number>;
    options?: Array<{ text: string; mediaUrl?: string | null }>;
  }) {
    const isMcq = payload.type === QuestionType.SINGLE_CHOICE || payload.type === QuestionType.MULTIPLE_CHOICE;
    const isText = payload.type === QuestionType.TRUE_FALSE || payload.type === QuestionType.NUMERICAL || payload.type === QuestionType.FILL_IN_THE_BLANK;

    if (isMcq) {
      if (!payload.options?.length || payload.options.length < 2) {
        throw new BadRequestError('Options are required for MCQ question types');
      }
      if (!payload.correctOptionIdsAnswers?.length) {
        throw new BadRequestError('correctOptionIdsAnswers is required for MCQ question types');
      }
    }

    if (isText) {
      if (!payload.correctTextAnswer || payload.correctTextAnswer.trim().length === 0) {
        throw new BadRequestError('correctTextAnswer is required for this question type');
      }
    }
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
    const test = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, test.batchId);
    }
    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    this.validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const created = await questionRepo.createExamTestQuestionResolvingCorrect(businessId, examTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionRefs: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });
    if (!created) throw new NotFoundError('Exam test not found');
    return created;
  }

  async updateQuestion(businessId: number, questionId: string, dto: UpdateQuestionDto, user: { id: number; role: UserRole }) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const testId = existing.examTestId;
    if (!testId) throw new BadRequestError('Question does not belong to an exam test');
    const test = await this.getWithAccess(businessId, testId, user);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, test.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, testId);
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

    this.validateQuestionPayload({
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
    const testId = existing.examTestId;
    if (!testId) throw new BadRequestError('Question does not belong to an exam test');
    const test = await this.getWithAccess(businessId, testId, user);
    if (user.role === UserRole.TEACHER) {
      await this.assertTeacherInBatch(user.id, test.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}

