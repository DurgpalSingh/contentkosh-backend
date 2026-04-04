// `sanitize-html` typings are not present in this repo.
// We only need runtime behavior; TypeScript safety is enforced via our allowlist config.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import sanitizeHtml from 'sanitize-html';
import logger from './logger';
import { BadRequestError } from '../errors/api.errors';
import {
  QUIll_HTML_MAX_INPUT_CHARS,
  QUIll_HTML_MAX_STORED_CHARS,
  QUIll_SANITIZE_ALLOWED_ATTRIBUTES,
  QUIll_SANITIZE_ALLOWED_CLASSES,
  QUIll_SANITIZE_ALLOWED_SCHEMES,
  QUIll_SANITIZE_ALLOWED_TAGS,
  QUIll_SANITIZE_DISALLOWED_TAGS_MODE,
  QUIll_SANITIZE_LINK_REL,
  QUIll_SANITIZE_LINK_TARGET,
} from '../config/quillSanitizeConfig';

type QuillField = 'questionText' | 'explanation';

/** Options passed to `sanitize-html` for Quill content; built from `quillSanitizeConfig`. */
function buildQuillSanitizeHtmlOptions(): Record<string, unknown> {
  const allowedAttributes: Record<string, string[]> = {};
  for (const tag of Object.keys(QUIll_SANITIZE_ALLOWED_ATTRIBUTES)) {
    allowedAttributes[tag] = [...QUIll_SANITIZE_ALLOWED_ATTRIBUTES[tag]!];
  }

  return {
    allowedTags: [...QUIll_SANITIZE_ALLOWED_TAGS],
    allowedAttributes,
    allowedSchemes: [...QUIll_SANITIZE_ALLOWED_SCHEMES],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: QUIll_SANITIZE_LINK_TARGET,
        rel: QUIll_SANITIZE_LINK_REL,
      }),
    },
    disallowedTagsMode: QUIll_SANITIZE_DISALLOWED_TAGS_MODE,
    allowedClasses: QUIll_SANITIZE_ALLOWED_CLASSES,
  };
}

const quillSanitizeHtmlOptions = buildQuillSanitizeHtmlOptions();

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
  if (input.length > QUIll_HTML_MAX_INPUT_CHARS) {
    logger.warn('[test-module] Quill HTML rejected: input too large', {
      fieldLabel,
      inputChars: input.length,
      ...(context ?? {}),
    });
    throw new BadRequestError(`${fieldLabel} is too large`);
  }

  const sanitized = sanitizeHtml(input, quillSanitizeHtmlOptions as Parameters<typeof sanitizeHtml>[1]);

  if (sanitized.length > QUIll_HTML_MAX_STORED_CHARS) {
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

