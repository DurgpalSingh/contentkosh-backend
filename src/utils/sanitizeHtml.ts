// `sanitize-html` typings are not present in this repo.
// We only need runtime behavior; TypeScript safety is enforced via our allowlist config.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sanitizeHtml from 'sanitize-html';
import logger from './logger';
import { BadRequestError } from '../errors/api.errors';

const MAX_QUIll_HTML_INPUT_CHARS = 50000;
const MAX_QUIll_HTML_STORED_CHARS = 20000;

type QuillField = 'questionText' | 'explanation';

function getMeaningfulTextLength(html: string): number {
  // Strip tags and normalize whitespace to approximate "empty" content.
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function sanitizeQuillHtmlInternal(
  input: string,
  fieldLabel: QuillField,
  isRequired: boolean,
  context?: Record<string, unknown>,
): string {
  if (input.length > MAX_QUIll_HTML_INPUT_CHARS) {
    logger.warn('[test-module] Quill HTML rejected: input too large', {
      fieldLabel,
      inputChars: input.length,
      ...(context ?? {}),
    });
    throw new BadRequestError(`${fieldLabel} is too large`);
  }

  const sanitized = sanitizeHtml(input, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'h1',
      'h2',
      'h3',
      'blockquote',
      'ol',
      'ul',
      'li',
      'a',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['class'],
      p: ['class'],
    },
    allowedSchemes: ['http', 'https'],
    // Disallow Quill-style CSS classes unless they start with `ql-` to avoid arbitrary styling.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    } as any,
    // Strip everything else.
    disallowedTagsMode: 'discard',
    allowedClasses: false,
  });

  if (sanitized.length > MAX_QUIll_HTML_STORED_CHARS) {
    logger.warn('[test-module] Quill HTML rejected: sanitized too large', {
      fieldLabel,
      sanitizedChars: sanitized.length,
      ...(context ?? {}),
    });
    throw new BadRequestError(`${fieldLabel} is too large`);
  }

  if (getMeaningfulTextLength(sanitized) === 0) {
    if (isRequired) {
      logger.warn('[test-module] Quill HTML rejected: empty after sanitization', { fieldLabel });
      throw new BadRequestError(`${fieldLabel} cannot be empty`);
    }

    // Treat Quill placeholder content as "no content".
    return '';
  }

  return sanitized;
}

export function sanitizeRequiredQuillHtml(
  input: string,
  fieldLabel: QuillField,
  context?: Record<string, unknown>,
): string {
  return sanitizeQuillHtmlInternal(input, fieldLabel, true, context);
}

export function sanitizeOptionalQuillHtml(
  input: string | null | undefined,
  fieldLabel: QuillField,
  context?: Record<string, unknown>,
): string | null {
  if (input === undefined) return null;
  if (input === null) return null;
  if (input.trim().length === 0) return null;
  const sanitized = sanitizeQuillHtmlInternal(input, fieldLabel, false, context);
  return sanitized.length ? sanitized : null;
}

