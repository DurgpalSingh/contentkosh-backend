/**
 * Single place to tune rich-text HTML allowlists (Quill/TipTap + math) for `sanitize-html`.
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
  'div',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
] as const;

/** Per-tag allowed attributes (keys must match tags present in content). */
export const QUIll_SANITIZE_ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'target', 'rel'],
  span: ['class', 'data-type', 'data-latex'],
  p: ['class'],
  div: ['class', 'data-type', 'data-latex'],
  table: ['class', 'style', 'width'],
  thead: ['class'],
  tbody: ['class'],
  tfoot: ['class'],
  tr: ['class'],
  th: ['class', 'style', 'colspan', 'rowspan', 'align', 'colwidth', 'width'],
  td: ['class', 'style', 'colspan', 'rowspan', 'align', 'colwidth', 'width'],
  caption: ['class'],
  colgroup: ['class', 'span', 'width'],
  col: ['class', 'span', 'width'],
} as const;

export const QUIll_SANITIZE_ALLOWED_SCHEMES = ['http', 'https'] as const;

export const QUIll_SANITIZE_DISALLOWED_TAGS_MODE = 'discard' as const;

/**
 * When false at the top level, `sanitize-html` strips disallowed classes (see library docs).
 * TipTap math is stored as `data-latex` on span/div; classes are not required for rendering.
 */
export const QUIll_SANITIZE_ALLOWED_CLASSES = false as const;

export const QUIll_SANITIZE_LINK_TARGET = '_blank' as const;
export const QUIll_SANITIZE_LINK_REL = 'noopener noreferrer' as const;
