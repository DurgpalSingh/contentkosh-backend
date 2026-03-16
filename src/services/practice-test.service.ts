import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as practiceRepo from '../repositories/practice-test.repo';
import * as questionRepo from '../repositories/test-question.repo';
import { TestStatus, QuestionType } from '../constants/test-enums';

export class PracticeTestService {
  async create(businessId: number, dto: any, userId: number) {
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
      createdBy: userId,
    });
    return created;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }) {
    const where: any = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    return practiceRepo.findPracticeTestsByBusinessId(businessId, { where });
  }

  async get(businessId: number, practiceTestId: string) {
    const t = await practiceRepo.findPracticeTestById(businessId, practiceTestId);
    if (!t) throw new NotFoundError('Practice test not found');
    return t;
  }

  async update(businessId: number, practiceTestId: string, dto: any, userId: number) {
    const updated = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      ...(dto.batchId !== undefined ? { batchId: dto.batchId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.defaultMarksPerQuestion !== undefined ? { defaultMarksPerQuestion: dto.defaultMarksPerQuestion } : {}),
      ...(dto.showExplanations !== undefined ? { showExplanations: dto.showExplanations } : {}),
      ...(dto.shuffleQuestions !== undefined ? { shuffleQuestions: dto.shuffleQuestions } : {}),
      ...(dto.shuffleOptions !== undefined ? { shuffleOptions: dto.shuffleOptions } : {}),
      updatedBy: userId,
    });
    if (!updated) throw new NotFoundError('Practice test not found');
    return updated;
  }

  async remove(businessId: number, practiceTestId: string) {
    const r = await practiceRepo.deletePracticeTest(businessId, practiceTestId);
    if (!r.count) throw new NotFoundError('Practice test not found');
    return;
  }

  async publish(businessId: number, practiceTestId: string, userId: number) {
    const existing = await this.get(businessId, practiceTestId);
    if (existing.status !== TestStatus.DRAFT) {
      throw new BadRequestError('Only draft tests can be published');
    }
    const questionCount = await questionRepo.countQuestionsForPracticeTest(businessId, practiceTestId);
    if (questionCount < 1) {
      throw new BadRequestError('Add at least one question before publishing');
    }
    const updated = await practiceRepo.updatePracticeTest(businessId, practiceTestId, {
      status: TestStatus.PUBLISHED,
      updatedBy: userId,
    });
    if (!updated) throw new NotFoundError('Practice test not found');
    return updated;
  }

  async listQuestions(businessId: number, practiceTestId: string) {
    // Ensure parent exists
    await this.get(businessId, practiceTestId);
    return questionRepo.listPracticeTestQuestions(businessId, practiceTestId);
  }

  private validateQuestionPayload(payload: {
    type: number;
    correctTextAnswer?: string | null;
    correctOptionIdsAnswers?: string[];
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

  async createQuestion(businessId: number, practiceTestId: string, dto: any) {
    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, practiceTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    this.validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const created = await questionRepo.createPracticeTestQuestion(businessId, practiceTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o: any) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    if (!created) throw new NotFoundError('Practice test not found');
    return created;
  }

  async updateQuestion(businessId: number, questionId: string, dto: any) {
    const existing = await questionRepo.findQuestionById(businessId, questionId);
    if (!existing) throw new NotFoundError('Question not found');

    const testId = existing.practiceTestId;
    if (!testId) throw new BadRequestError('Question does not belong to a practice test');

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, testId);
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
    const testId = existing.practiceTestId;
    if (!testId) throw new BadRequestError('Question does not belong to a practice test');

    const hasAttempts = await questionRepo.hasAttemptsForPracticeTest(businessId, testId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}

