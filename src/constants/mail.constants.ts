export const GMAIL_API = {
  SEND_ENDPOINT: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
} as const;

export const MIME_MESSAGE = {
  LINE_BREAK: '\r\n',
  VERSION_HEADER: 'MIME-Version: 1.0',
  CONTENT_TYPE_HTML_HEADER: 'Content-Type: text/html; charset=utf-8',
} as const;

export const BASE64URL_REPLACEMENTS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\+/g, replacement: '-' },
  { pattern: /\//g, replacement: '_' },
  { pattern: /=+$/, replacement: '' },
];

export const MAIL_ERROR_MESSAGES = {
  MISSING_OAUTH_CONFIG: 'Gmail API is not configured: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN',
  MISSING_SENDER: 'Gmail API is not configured: set GMAIL_SENDER_EMAIL',
  MISSING_ACCESS_TOKEN: 'Failed to obtain a Gmail API access token',
  SEND_FAILED_PREFIX: 'Gmail API request failed',
} as const;
