import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as examRepo from '../repositories/exam-test.repo';
import * as questionRepo from '../repositories/test-question.repo';
import { TestStatus, QuestionType, ResultVisibilityExam } from '../constants/test-enums';
import logger from '../utils/logger';

export class ExamTestService {
  async create(businessId: number, dto: any, userId: number) {
    logger.info(`[exam-test] create businessId=${businessId} userId=${userId} batchId=${dto?.batchId}`);
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
      createdBy: userId,
    });
    return created;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }) {
    logger.info(`[exam-test] list businessId=${businessId} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`);
    const where: any = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    return examRepo.findExamTestsByBusinessId(businessId, { where });
  }

  async get(businessId: number, examTestId: string) {
    logger.info(`[exam-test] get businessId=${businessId} examTestId=${examTestId}`);
    const t = await examRepo.findExamTestById(businessId, examTestId);
    if (!t) throw new NotFoundError('Exam test not found');
    return t;
  }

  async update(businessId: number, examTestId: string, dto: any, userId: number) {
    logger.info(`[exam-test] update businessId=${businessId} examTestId=${examTestId} userId=${userId}`);
    const existing = await this.get(businessId, examTestId);

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
      updatedBy: userId,
    });
    if (!updated) throw new NotFoundError('Exam test not found');
    return updated;
  }

  async remove(businessId: number, examTestId: string) {
    logger.info(`[exam-test] remove businessId=${businessId} examTestId=${examTestId}`);
    const r = await examRepo.deleteExamTest(businessId, examTestId);
    if (!r.count) throw new NotFoundError('Exam test not found');
    return;
  }

  async publish(businessId: number, examTestId: string, userId: number) {
    logger.info(`[exam-test] publish businessId=${businessId} examTestId=${examTestId} userId=${userId}`);
    const existing = await this.get(businessId, examTestId);
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
      updatedBy: userId,
    });
    if (!updated) throw new NotFoundError('Exam test not found');
    return updated;
  }

  async listQuestions(businessId: number, examTestId: string) {
    logger.info(`[exam-test] listQuestions businessId=${businessId} examTestId=${examTestId}`);
    await this.get(businessId, examTestId);
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

  async createQuestion(businessId: number, examTestId: string, dto: any) {
    logger.info(`[exam-test] createQuestion businessId=${businessId} examTestId=${examTestId} type=${dto?.type}`);
    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    this.validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const created = await questionRepo.createExamTestQuestionResolvingCorrect(businessId, examTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionRefs: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });
    if (!created) throw new NotFoundError('Exam test not found');
    return created;
  }

  async updateQuestion(businessId: number, questionId: string, dto: any) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const testId = existing.examTestId;
    if (!testId) throw new BadRequestError('Question does not belong to an exam test');

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    const newType = dto.type ?? existing.type;
    const options = dto.options?.map((o: any) => ({ id: o.id, text: o.text, mediaUrl: o.mediaUrl ?? null }));
    const correctOptionIdsAnswers = dto.correctOptionIdsAnswers ?? existing.correctOptionIdsAnswers ?? [];
    const correctTextAnswer = dto.correctTextAnswer ?? existing.correctTextAnswer ?? null;

    this.validateQuestionPayload({
      type: newType,
      correctTextAnswer,
      correctOptionIdsAnswers,
      options: options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? existing.options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const updated = await questionRepo.updateQuestionAndOptions(businessId, questionId, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.questionText !== undefined ? { text: dto.questionText } : {}),
      ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
      ...(dto.correctTextAnswer !== undefined ? { correctTextAnswer: dto.correctTextAnswer } : {}),
      ...(dto.correctOptionIdsAnswers !== undefined ? { correctOptionIdsAnswers: dto.correctOptionIdsAnswers } : {}),
      ...(dto.options !== undefined ? { options } : {}),
    });
    if (!updated) throw new NotFoundError('Question not found');
    return updated;
  }

  async deleteQuestion(businessId: number, questionId: string) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');
    const testId = existing.examTestId;
    if (!testId) throw new BadRequestError('Question does not belong to an exam test');

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}

