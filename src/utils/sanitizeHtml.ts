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

type RichTextField = 'questionText' | 'explanation' | string;

/** Options passed to `sanitize-html` for rich-text content; built from `quillSanitizeConfig`. */
function buildQuillSanitizeHtmlOptions(): Record<string, unknown> {
  const allowedAttributes: Record<string, string[]> = {};
  for (const tag of Object.keys(QUIll_SANITIZE_ALLOWED_ATTRIBUTES)) {
    allowedAttributes[tag] = [...QUIll_SANITIZE_ALLOWED_ATTRIBUTES[tag]!];
  }

  return {
    allowedTags: [...QUIll_SANITIZE_ALLOWED_TAGS],
    allowedAttributes,
    allowedSchemes: [...QUIll_SANITIZE_ALLOWED_SCHEMES],
    // allow data: URIs for embedded base64 images
    allowedSchemesByTag: {
      img: [...QUIll_SANITIZE_ALLOWED_SCHEMES],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: QUIll_SANITIZE_LINK_TARGET,
        rel: QUIll_SANITIZE_LINK_REL,
      }),
    },
    disallowedTagsMode: QUIll_SANITIZE_DISALLOWED_TAGS_MODE,
    allowedClasses: QUIll_SANITIZE_ALLOWED_CLASSES,
    allowedStyles: {
      '*': {
        // Allow alignment and sizing styles used by the editor
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        'float': [/^left$/, /^right$/, /^none$/],
        'margin': [/^.*$/],
        'display': [/^.*$/],
        'width': [/^.*$/],
        'height': [/^.*$/],
      },
    },
  };
}

const quillSanitizeHtmlOptions = buildQuillSanitizeHtmlOptions();

function getMeaningfulTextLength(html: string): number {
  const textFromTags = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const latexParts = [...html.matchAll(/data-latex="([^"]*)"/g)]
    .map((m) => m[1])
    .join(' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const combined = `${textFromTags} ${latexParts}`.replace(/\s+/g, ' ').trim();
  
  // If there's no text, check if there are images or math blocks. 
  // Each image counts as "meaningful" content.
  const imageCount = (html.match(/<img/g) || []).length;
  return combined.length + (imageCount * 10);
}

/**
 * Returns the length of the HTML string after replacing large Base64 image data 
 * with a placeholder to prevent "content too large" errors caused by image attachments.
 */
function getHtmlLengthExcludingImages(html: string): number {
  // Replace base64 src data with a small 20-char placeholder for counting purposes
  return html.replace(/src=["']data:image\/[^;]+;base64,[^"']+["']/g, 'src="data:image/placeholder"').length;
}

function sanitizeQuillHtmlInternal(
  input: string,
  fieldLabel: RichTextField,
  isRequired: boolean,
  context?: Record<string, unknown>,
): string {
  const inputLengthForLimit = getHtmlLengthExcludingImages(input);
  if (inputLengthForLimit > QUIll_HTML_MAX_INPUT_CHARS) {
    logger.warn('[test-module] Rich text HTML rejected: input too large', {
      fieldLabel,
      inputCharsExcludingImages: inputLengthForLimit,
      ...(context ?? {}),
    });
    throw new BadRequestError(`${fieldLabel} is too large`);
  }

  const sanitized = sanitizeHtml(input, quillSanitizeHtmlOptions as Parameters<typeof sanitizeHtml>[1]);

  const sanitizedLengthForLimit = getHtmlLengthExcludingImages(sanitized);
  if (sanitizedLengthForLimit > QUIll_HTML_MAX_STORED_CHARS) {
    logger.warn('[test-module] Rich text HTML rejected: sanitized too large', {
      fieldLabel,
      sanitizedCharsExcludingImages: sanitizedLengthForLimit,
      ...(context ?? {}),
    });
    throw new BadRequestError(`${fieldLabel} is too large`);
  }

  if (getMeaningfulTextLength(sanitized) === 0) {
    if (isRequired) {
      logger.warn('[test-module] Rich text HTML rejected: empty after sanitization', { fieldLabel });
      throw new BadRequestError(`${fieldLabel} cannot be empty`);
    }

    // Treat empty placeholder content as "no content".
    return '';
  }

  return sanitized;
}

export function sanitizeRequiredQuillHtml(
  input: string,
  fieldLabel: RichTextField,
  context?: Record<string, unknown>,
): string {
  return sanitizeQuillHtmlInternal(input, fieldLabel, true, context);
}

export function sanitizeOptionalQuillHtml(
  input: string | null | undefined,
  fieldLabel: RichTextField,
  context?: Record<string, unknown>,
): string | null {
  if (input === undefined) return null;
  if (input === null) return null;
  if (input.trim().length === 0) return null;
  const sanitized = sanitizeQuillHtmlInternal(input, fieldLabel, false, context);
  return sanitized.length ? sanitized : null;
}

