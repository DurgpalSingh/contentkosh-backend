export const TestStatus = {
  DRAFT: 0,
  PUBLISHED: 1,
} as const;

export type TestStatus = (typeof TestStatus)[keyof typeof TestStatus];

export const QuestionType = {
  SINGLE_CHOICE: 0,
  MULTIPLE_CHOICE: 1,
  TRUE_FALSE: 2,
  NUMERICAL: 3,
  FILL_IN_THE_BLANK: 4,
} as const;

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const ResultVisibilityExam = {
  AFTER_DEADLINE: 0,
  HIDDEN: 1,
} as const;

export type ResultVisibilityExam = (typeof ResultVisibilityExam)[keyof typeof ResultVisibilityExam];

export const AttemptStatus = {
  IN_PROGRESS: 0,
  SUBMITTED: 1,
  AUTO_SUBMITTED: 2,
  EXPIRED: 3,
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

// API-only enum (not persisted)
export const LockedReason = {
  NOT_STARTED: 0,
  DEADLINE_PASSED: 1,
  ALREADY_ATTEMPTED: 2,
} as const;

export type LockedReason = (typeof LockedReason)[keyof typeof LockedReason];

function values<T extends Record<string, number>>(obj: T): number[] {
  return Object.values(obj);
}

export function isTestStatus(v: unknown): v is TestStatus {
  return typeof v === 'number' && values(TestStatus).includes(v);
}

export function isQuestionType(v: unknown): v is QuestionType {
  return typeof v === 'number' && values(QuestionType).includes(v);
}

export function isResultVisibilityExam(v: unknown): v is ResultVisibilityExam {
  return typeof v === 'number' && values(ResultVisibilityExam).includes(v);
}

export function isAttemptStatus(v: unknown): v is AttemptStatus {
  return typeof v === 'number' && values(AttemptStatus).includes(v);
}

export function toTestStatusLabel(v: TestStatus): 'DRAFT' | 'PUBLISHED' {
  return v === TestStatus.DRAFT ? 'DRAFT' : 'PUBLISHED';
}

export function toQuestionTypeLabel(v: QuestionType) {
  switch (v) {
    case QuestionType.SINGLE_CHOICE: return 'SINGLE_CHOICE';
    case QuestionType.MULTIPLE_CHOICE: return 'MULTIPLE_CHOICE';
    case QuestionType.TRUE_FALSE: return 'TRUE_FALSE';
    case QuestionType.NUMERICAL: return 'NUMERICAL';
    case QuestionType.FILL_IN_THE_BLANK: return 'FILL_IN_THE_BLANK';
  }
}

export function toResultVisibilityExamLabel(v: ResultVisibilityExam): 'AFTER_DEADLINE' | 'HIDDEN' {
  return v === ResultVisibilityExam.AFTER_DEADLINE ? 'AFTER_DEADLINE' : 'HIDDEN';
}

export function toAttemptStatusLabel(v: AttemptStatus) {
  switch (v) {
    case AttemptStatus.IN_PROGRESS: return 'IN_PROGRESS';
    case AttemptStatus.SUBMITTED: return 'SUBMITTED';
    case AttemptStatus.AUTO_SUBMITTED: return 'AUTO_SUBMITTED';
    case AttemptStatus.EXPIRED: return 'EXPIRED';
  }
}

