import { TestOption, TestQuestion } from '@prisma/client';
import { QuestionType } from '../constants/test-enums';

export type SubmitAnswerPayload = {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
};

export type QuestionOptionRecord = Pick<TestOption, 'id' | 'text' | 'mediaUrl'>;
export type ScoringQuestionRecord = Pick<
  TestQuestion,
  'id' | 'type' | 'text' | 'correctTextAnswer' | 'correctOptionIdsAnswers' | 'mediaUrl'
> & {
  options: QuestionOptionRecord[];
};

export function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

export function normalizeNumeric(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function evaluateQuestion(params: {
  question: ScoringQuestionRecord;
  provided: SubmitAnswerPayload | undefined;
  isExam: boolean;
  defaultMarksPerQuestion: number;
  negativeMarksPerQuestion: number;
}): { isCorrect: boolean | null; obtainedMarks: number | null; selectedOptionIds: string[]; textAnswer: string | null } {
  const { question, provided, isExam, defaultMarksPerQuestion, negativeMarksPerQuestion } = params;

  const selectedOptionIds = (provided?.selectedOptionIds ?? []).filter(Boolean);
  const textAnswer = provided?.textAnswer !== undefined ? String(provided.textAnswer) : null;

  const answered = selectedOptionIds.length > 0 || (textAnswer !== null && textAnswer.trim().length > 0);

  if (!answered) {
    return { isCorrect: null, obtainedMarks: 0, selectedOptionIds: [], textAnswer: textAnswer?.trim().length ? textAnswer : null };
  }

  const type = question.type;
  const isMcq = type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE;
  const isText = type === QuestionType.TRUE_FALSE || type === QuestionType.NUMERICAL || type === QuestionType.FILL_IN_THE_BLANK;

  let correct = false;

  if (isMcq) {
    const correctIds: string[] = (question.correctOptionIdsAnswers ?? []).filter(Boolean);
    const a = new Set(selectedOptionIds);
    const b = new Set(correctIds);
    if (a.size === b.size) {
      correct = true;
      for (const id of a) {
        if (!b.has(id)) {
          correct = false;
          break;
        }
      }
    }
  } else if (isText) {
    const expected = question.correctTextAnswer ?? '';
    if (type === QuestionType.NUMERICAL) {
      const e = normalizeNumeric(expected);
      const p = normalizeNumeric(textAnswer ?? '');
      correct = e !== null && p !== null && e === p;
    } else {
      correct = normalizeText(expected) === normalizeText(textAnswer ?? '');
    }
  } else {
    correct = false;
  }

  if (correct) {
    return { isCorrect: true, obtainedMarks: defaultMarksPerQuestion, selectedOptionIds, textAnswer };
  }

  const obtainedMarks = isExam ? -negativeMarksPerQuestion : 0;
  return { isCorrect: false, obtainedMarks, selectedOptionIds, textAnswer };
}
