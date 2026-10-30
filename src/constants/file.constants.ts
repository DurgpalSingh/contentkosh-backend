export const FILE_EXTENSIONS = {
  PDF: '.pdf',
  DOC: '.doc',
  DOCX: '.docx',
  XLS: '.xls',
  XLSX: '.xlsx',

  JPG: '.jpg',
  JPEG: '.jpeg',
  PNG: '.png',
  WEBP: '.webp',
  GIF: '.gif'
};

export const IMAGE_EXTENSIONS = [
  FILE_EXTENSIONS.JPG,
  FILE_EXTENSIONS.JPEG,
  FILE_EXTENSIONS.PNG
];

export const FILE_FORMATS = {
  PDF: 'pdf',
  DOC: 'doc',
  DOCX: 'docx',
  XLS: 'xls',
  XLSX: 'xlsx',

  JPG: 'jpg',
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
  GIF: 'gif'
};

export const MIME_TYPES = {
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',

  DEFAULT: 'application/octet-stream'
};

/** Entity name for missing files: `NotFoundError(FILE_ENTITY_LABEL)` → "File not found". */
export const FILE_ENTITY_LABEL = 'File';

export const FILE_NAME_RULES = {
  /** Between the generated name and the uploader's name in a storage key: `<generated>__<original>`. */
  ORIGINAL_NAME_SEPARATOR: '__',
  UNSAFE_CHARACTER_REPLACEMENT: '_',
  /** Separator in storage keys and URL paths (on every OS). */
  PATH_SEPARATOR: '/',
  TEMP_FILE_PREFIX: 'tmp',
  FALLBACK_PDF_NAME: 'file.pdf',
  FALLBACK_NAME: 'file',
} as const;

export const FILE_PATH_REGEX = {
  /** Windows separators, to normalise paths to `/`. */
  BACKSLASHES: /\\/g,
  /** Leading `/` of a URL path, to turn `/uploads/x.png` into a path relative to the working directory. */
  LEADING_SLASHES: /^\/+/,
  /** An absolute `http(s)://` URL (as opposed to a `/uploads/...` path). */
  ABSOLUTE_HTTP_URL: /^https?:\/\//i,
  /** Anything except letters (any language), digits, space, `.`, `_` and `-`. */
  UNSAFE_FILE_NAME_CHARACTERS: /[^\p{L}\p{M}\p{N} ._-]+/gu,
} as const;
