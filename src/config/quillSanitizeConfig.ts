/**
 * Single place to tune Quill/rich-text HTML allowlists for `sanitize-html`.
 * Adjust tags, attributes, schemes, and size limits here.
 */
export const QUIll_HTML_MAX_INPUT_CHARS = 50000 as const;
export const QUIll_HTML_MAX_STORED_CHARS = 20000 as const;

export const QUIll_SANITIZE_ALLOWED_TAGS = [
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
] as const;

/** Per-tag allowed attributes (keys must match tags present in content). */
export const QUIll_SANITIZE_ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'target', 'rel'],
  span: ['class'],
  p: ['class'],
} as const;

export const QUIll_SANITIZE_ALLOWED_SCHEMES = ['http', 'https'] as const;

export const QUIll_SANITIZE_DISALLOWED_TAGS_MODE = 'discard' as const;

/** When false, arbitrary classes are stripped (Quill `ql-*` classes are not preserved unless configured otherwise). */
export const QUIll_SANITIZE_ALLOWED_CLASSES = false as const;

export const QUIll_SANITIZE_LINK_TARGET = '_blank' as const;
export const QUIll_SANITIZE_LINK_REL = 'noopener noreferrer' as const;
