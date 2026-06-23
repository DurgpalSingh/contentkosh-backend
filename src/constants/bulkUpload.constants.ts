import { QuestionType } from './test-enums';

export const BULK_UPLOAD_TEST_TYPES = {
  PRACTICE: 'practice',
  EXAM: 'exam',
} as const;

export type BulkUploadTestType =
  (typeof BULK_UPLOAD_TEST_TYPES)[keyof typeof BULK_UPLOAD_TEST_TYPES];

export const BULK_UPLOAD_MIME_HINTS = {
  SPREADSHEET: 'spreadsheet',
  EXCEL: 'excel',
} as const;

export const BULK_UPLOAD_CHOICE_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
] as const;

export const BULK_UPLOAD_QUESTION_TYPE_MAP: Record<string, number> = {
  SINGLE_CHOICE: QuestionType.SINGLE_CHOICE,
  MULTIPLE_CHOICE: QuestionType.MULTIPLE_CHOICE,
  TRUE_FALSE: QuestionType.TRUE_FALSE,
  NUMERICAL: QuestionType.NUMERICAL,
  FILL_IN_THE_BLANK: QuestionType.FILL_IN_THE_BLANK,
};

export const BULK_UPLOAD_DEFAULT_QUESTION_TYPE = QuestionType.SINGLE_CHOICE;

export const BULK_UPLOAD_OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export const BULK_UPLOAD_ANSWER_SEPARATOR = ',';

export const BULK_UPLOAD_FIELD_NAMES = {
  FIELD: 'field',
  VALUE: 'value',
  QUESTION: 'question',
  QUESTION_TEXT: 'question text',
  TYPE: 'type',
  QUESTION_TYPE: 'question type',
  OPTIONS: 'options',
  OPTION: 'option',
  OPTIONS_GROUP: 'options_group',
  ANSWER: 'answer',
  CORRECT_ANSWER: 'correct answer',
  SOLUTION: 'solution',
  EXPLANATION: 'explanation',
} as const;

export const BULK_UPLOAD_HTML = {
  EMPTY_PARAGRAPH: '<p></p>',
  BR: '<br/>',
  PARAGRAPH: 'p',
  STRONG: 'strong',
  EMPHASIS: 'em',
  UNDERLINE: 'u',
  STRIKE: 's',
  HEADING: 'h',
  ORDERED_LIST: 'ol',
  UNORDERED_LIST: 'ul',
  TABLE: 'table',
  TABLE_BODY: 'tbody',
  TABLE_HEAD: 'thead',
  TABLE_ROW: 'tr',
  TABLE_HEADER_CELL: 'th',
  TABLE_CELL: 'td',
  LIST_ITEM: 'li',
} as const;

export const OFFICE_NODE_TYPES = {
  PARAGRAPH: 'paragraph',
  TEXT: 'text',
  HEADING: 'heading',
  LIST: 'list',
  ORDERED_LIST: 'ordered',
  TABLE: 'table',
  ROW: 'row',
  CELL: 'cell',
} as const;

export const BULK_UPLOAD_REGEX = {
  OPTION_SPLIT: /(?=[A-D]\.\s)/,
  OPTION_PREFIX: /^[A-D]\.\s/,
  OPTION_TEXT_PREFIX: /^[A-Z]\.\s*/i,
  MARKDOWN_TABLE_DIVIDER: /^\s*\|[-:| ]+\|\s*$/,
  BULLET_LIST_ITEM: /^[-*]\s/,
  NUMBERED_LIST_ITEM: /^\d+[.)]\s/,
  PIPE_BOUNDARY: /^\||\|$/g,
  OPTION_COLUMN_KEY: /^[a-f]$/,
} as const;
