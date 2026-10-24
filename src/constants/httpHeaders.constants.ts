export const HTTP_HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  CONTENT_DISPOSITION: 'Content-Disposition',
  CACHE_CONTROL: 'Cache-Control',
} as const;

export const CACHE_CONTROL_VALUES = {
  /** Streamed private files (content, subjective PDFs): never cached. */
  PRIVATE_NO_STORE: 'private, no-store',
  /** Logged-in `/uploads` images: cached briefly by the browser only. */
  PRIVATE_SHORT: 'private, max-age=300',
} as const;
