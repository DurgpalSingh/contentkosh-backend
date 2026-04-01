import sanitizeHtml from 'sanitize-html';
import { BadRequestError } from '../errors/api.errors';

const questionHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'h1',
    'h2',
    'h3',
    'img',
    'span',
    'div',
    'pre',
    'code',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'data'],
  allowedSchemesByTag: {},
};

export const MAX_QUESTION_HTML_CHARS = 50_000;

export function sanitizeQuestionHtml(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length > MAX_QUESTION_HTML_CHARS) {
    throw new BadRequestError(`Content exceeds maximum length of ${MAX_QUESTION_HTML_CHARS} characters`);
  }
  return sanitizeHtml(trimmed, questionHtmlOptions);
}

export function sanitizeOptionalQuestionHtml(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  return sanitizeQuestionHtml(raw);
}
