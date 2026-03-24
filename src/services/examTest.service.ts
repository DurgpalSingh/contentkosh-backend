import { BadRequestError, NotFoundError } from '../errors/api.errors';
import * as examRepo from '../repositories/examTest.repo';
import * as questionRepo from '../repositories/testQuestion.repo';
import { TestStatus, ResultVisibilityExam } from '../constants/test-enums';
import logger from '../utils/logger';
import { CreateExamTestDto, CreateQuestionDto, UpdateExamTestDto, UpdateQuestionDto } from '../dtos/test.dto';
import { UserRole } from '@prisma/client';
import { validateQuestionPayload, assertTeacherInBatch, assertBatchBelongsToBusiness } from '../utils/test.utils';
import { TestMapper } from '../mappers/test.mapper';

export class ExamTestService {
  private isElevated(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPERADMIN;
  }

  private async getWithAccess(
    businessId: number,
    examTestId: string,
    user: { id: number; role: UserRole },
  ) {
    const examTestRecord =
      this.isElevated(user.role)
        ? await examRepo.findExamTestById(businessId, examTestId)
        : await examRepo.findExamTestByIdForUser(businessId, examTestId, user.id);
    if (!examTestRecord) {
      if (user.role === UserRole.TEACHER) {
        logger.warn(
          `[exam-test] getWithAccess miss (teacher batch scope) businessId=${businessId} examTestId=${examTestId} userId=${user.id}`,
        );
      }
      throw new NotFoundError('Exam test not found');
    }
    return examTestRecord;
  }

  async create(businessId: number, dto: CreateExamTestDto, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] create businessId=${businessId} userId=${user.id} batchId=${dto?.batchId}`);
    await assertBatchBelongsToBusiness(businessId, dto.batchId);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, dto.batchId);
    }
    const startAt = new Date(dto.startAt);
    const deadlineAt = new Date(dto.deadlineAt);
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const createdExamTest = await examRepo.createExamTest({
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
    return createdExamTest;
  }

  async list(businessId: number, query: { status?: number; batchId?: number }, user: { id: number; role: UserRole }) {
    logger.info(
      `[exam-test] list businessId=${businessId} userId=${user.id} role=${user.role} status=${query?.status ?? 'any'} batchId=${query?.batchId ?? 'any'}`,
    );
    const where: { status?: number; batchId?: number } = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.batchId !== undefined) where.batchId = query.batchId;
    if (!this.isElevated(user.role)) {
      const examTests = await examRepo.findExamTestsByBusinessIdForUser(businessId, user.id, { where });
      return examTests.map((examTest) => TestMapper.examTest(examTest));
    }
    const examTests = await examRepo.findExamTestsByBusinessId(businessId, { where });
    return examTests.map((examTest) => TestMapper.examTest(examTest));
  }

  async get(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] get businessId=${businessId} examTestId=${examTestId} userId=${user.id} role=${user.role}`);
    const examTestRecord = await this.getWithAccess(businessId, examTestId, user);
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
    if (user.role === UserRole.TEACHER) {
      const exists = await examRepo.findExamTestById(businessId, examTestId);
      if (exists) {
        await assertTeacherInBatch(user.id, exists.batchId); // throws ForbiddenError (403) if not in batch
      }
      // If !exists, fall through — getWithAccess will throw 404
    }
    const existing = await this.getWithAccess(businessId, examTestId, user);

    if (dto.batchId !== undefined) {
      await assertBatchBelongsToBusiness(businessId, dto.batchId);
      if (user.role === UserRole.TEACHER) {
        await assertTeacherInBatch(user.id, dto.batchId);
      }
    }

    const startAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const deadlineAt = dto.deadlineAt !== undefined ? new Date(dto.deadlineAt) : existing.deadlineAt;
    if (!(deadlineAt > startAt)) {
      throw new BadRequestError('deadlineAt must be after startAt');
    }

    const updatedExamTest = await examRepo.updateExamTest(businessId, examTestId, {
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
    if (!updatedExamTest) throw new NotFoundError('Exam test not found');
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, updatedExamTest.batchId);
    }
    return updatedExamTest;
  }

  async remove(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] remove businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    if (user.role === UserRole.TEACHER) {
      const exists = await examRepo.findExamTestById(businessId, examTestId);
      if (exists) {
        await assertTeacherInBatch(user.id, exists.batchId); // throws ForbiddenError (403) if not in batch
      }
      // If !exists, fall through — getWithAccess will throw 404
    }
    const existing = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, existing.batchId);
    }
    const deleteResult = await examRepo.deleteExamTest(businessId, examTestId);
    if (!deleteResult.count) throw new NotFoundError('Exam test not found');
    return;
  }

  async publish(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] publish businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const existing = await this.getWithAccess(businessId, examTestId, user);
    await assertBatchBelongsToBusiness(businessId, existing.batchId);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, existing.batchId);
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
    return publishedExamTest;
  }

  async listQuestions(businessId: number, examTestId: string, user: { id: number; role: UserRole }) {
    logger.info(`[exam-test] listQuestions businessId=${businessId} examTestId=${examTestId} userId=${user.id}`);
    const examTestRecord = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, examTestRecord.batchId);
    }
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
    const examTestRecord = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, examTestRecord.batchId);
    }
    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    validateQuestionPayload({
      type: dto.type,
      correctTextAnswer: dto.correctTextAnswer ?? null,
      correctOptionIdsAnswers: dto.correctOptionIdsAnswers ?? [],
      options: dto.options?.map((o) => ({ text: o.text, mediaUrl: o.mediaUrl ?? null })) ?? [],
    });

    const createdQuestion = await questionRepo.createExamTestQuestionResolvingCorrect(businessId, examTestId, {
      type: dto.type,
      text: dto.questionText,
      mediaUrl: dto.mediaUrl ?? null,
      explanation: dto.explanation ?? null,
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
    const examTestRecord = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, examTestRecord.batchId);
    }

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
    const examTestId = existing.examTestId;
    if (!examTestId) throw new BadRequestError('Question does not belong to an exam test');
    const examTestRecord = await this.getWithAccess(businessId, examTestId, user);
    if (user.role === UserRole.TEACHER) {
      await assertTeacherInBatch(user.id, examTestRecord.batchId);
    }

    const hasAttempts = await questionRepo.hasAttemptsForExamTest(businessId, examTestId);
    if (hasAttempts) throw new BadRequestError('Cannot modify questions after attempts have started');

    await questionRepo.deleteQuestion(businessId, questionId);
  }
}


export const examTestService = new ExamTestService();
