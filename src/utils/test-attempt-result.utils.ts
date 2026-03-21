import { TestAttemptAnswer } from '@prisma/client';

type AnswerByQuestion = Pick<TestAttemptAnswer, 'questionId' | 'isCorrect' | 'obtainedMarks'>;

export function buildAnswersByQuestionIdMap(answers: TestAttemptAnswer[] | undefined | null): Map<string, TestAttemptAnswer> {
  const map = new Map<string, TestAttemptAnswer>();
  for (const a of answers ?? []) {
    map.set(a.questionId, a);
  }
  return map;
}

/** O(1) lookup for per-question result rows built from evaluated answers. */
export function buildEvaluatedByQuestionIdMap(
  evaluated: Array<{
    questionId: string;
    isCorrect: boolean | null;
    obtainedMarks: number | null;
  }>,
): Map<string, { questionId: string; isCorrect: boolean | null; obtainedMarks: number | null }> {
  const map = new Map<string, { questionId: string; isCorrect: boolean | null; obtainedMarks: number | null }>();
  for (const e of evaluated) {
    map.set(e.questionId, e);
  }
  return map;
}

export function mapSubmittedResultQuestion(
  q: { id: string; correctOptionIdsAnswers: string[] | null; correctTextAnswer: string | null },
  lookup: Map<string, { isCorrect: boolean | null; obtainedMarks: number | null }>,
) {
  const ev = lookup.get(q.id);
  return {
    questionId: q.id,
    isCorrect: ev?.isCorrect ?? null,
    obtainedMarks: ev?.obtainedMarks ?? null,
    correctOptionIds: q.correctOptionIdsAnswers ?? [],
    correctTextAnswer: q.correctTextAnswer ?? null,
  };
}

export function mapDetailResultQuestion(
  q: { id: string; correctOptionIdsAnswers: string[] | null; correctTextAnswer: string | null },
  answersByQuestionId: Map<string, AnswerByQuestion>,
) {
  const ans = answersByQuestionId.get(q.id);
  return {
    questionId: q.id,
    isCorrect: ans?.isCorrect ?? null,
    obtainedMarks: ans?.obtainedMarks ?? null,
    correctOptionIds: q.correctOptionIdsAnswers ?? [],
    correctTextAnswer: q.correctTextAnswer ?? null,
  };
}
