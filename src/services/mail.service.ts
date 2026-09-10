import { OAuth2Client } from 'google-auth-library';
import { mailConfig } from '../config/mail.config';
import { BASE64URL_REPLACEMENTS, GMAIL_API, MAIL_ERROR_MESSAGES, MIME_MESSAGE } from '../constants/mail.constants';

export interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
}

let cachedOAuthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, refreshToken } = mailConfig.gmail;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(MAIL_ERROR_MESSAGES.MISSING_OAUTH_CONFIG);
  }

  if (!cachedOAuthClient) {
    cachedOAuthClient = new OAuth2Client(clientId, clientSecret);
    cachedOAuthClient.setCredentials({ refresh_token: refreshToken });
  }

  return cachedOAuthClient;
}

function toBase64Url(input: string): string {
  const base64 = Buffer.from(input, 'utf-8').toString('base64');
  return BASE64URL_REPLACEMENTS.reduce((result, { pattern, replacement }) => result.replace(pattern, replacement), base64);
}

function buildRawMessage(params: { from: string; to: string; subject: string; html: string }): string {
  const message = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    MIME_MESSAGE.VERSION_HEADER,
    MIME_MESSAGE.CONTENT_TYPE_HTML_HEADER,
    '',
    params.html,
  ].join(MIME_MESSAGE.LINE_BREAK);

  return toBase64Url(message);
}

/**
 * Sends an email via the Gmail API using a pre-authorized OAuth2 refresh token.
 * Generic and reusable across features — throws on failure so each caller can
 * decide whether a failed send should be fatal to its own flow.
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const { senderEmail } = mailConfig.gmail;
  if (!senderEmail) {
    throw new Error(MAIL_ERROR_MESSAGES.MISSING_SENDER);
  }

  const client = getOAuthClient();
  const { token: accessToken } = await client.getAccessToken();
  if (!accessToken) {
    throw new Error(MAIL_ERROR_MESSAGES.MISSING_ACCESS_TOKEN);
  }

  const raw = buildRawMessage({
    from: senderEmail,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });

  const response = await fetch(GMAIL_API.SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`${MAIL_ERROR_MESSAGES.SEND_FAILED_PREFIX} (${response.status}): ${errorBody}`);
  }
}
