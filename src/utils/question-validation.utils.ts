import { BadRequestError } from '../errors/api.errors';
import { QuestionType } from '../constants/test-enums';

export function validateQuestionPayload(payload: {
  type: number;
  correctTextAnswer?: string | null;
  correctOptionIdsAnswers?: Array<string | number>;
  options?: Array<{ text: string; mediaUrl?: string | null }>;
}): void {
  const isMcq = payload.type === QuestionType.SINGLE_CHOICE || payload.type === QuestionType.MULTIPLE_CHOICE;
  const isText = ([QuestionType.TRUE_FALSE, QuestionType.NUMERICAL, QuestionType.FILL_IN_THE_BLANK] as number[]).includes(payload.type);

  if (isMcq) {
    if (!payload.options?.length || payload.options.length < 4) {
      throw new BadRequestError('MCQ questions require at least 4 options');
    }
    if (payload.options.length > 10) {
      throw new BadRequestError('MCQ questions allow at most 10 options');
    }
    if (!payload.correctOptionIdsAnswers?.length) {
      throw new BadRequestError('correctOptionIdsAnswers is required for MCQ question types');
    }
  }
  if (isText) {
    if (!payload.correctTextAnswer?.trim()) {
      throw new BadRequestError('correctTextAnswer is required for this question type');
    }
  }
}
