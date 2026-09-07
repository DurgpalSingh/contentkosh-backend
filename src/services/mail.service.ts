import { OAuth2Client } from 'google-auth-library';
import { mailConfig } from '../config/mail.config';

const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
}

let cachedOAuthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, refreshToken } = mailConfig.gmail;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail API is not configured: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN');
  }

  if (!cachedOAuthClient) {
    cachedOAuthClient = new OAuth2Client(clientId, clientSecret);
    cachedOAuthClient.setCredentials({ refresh_token: refreshToken });
  }

  return cachedOAuthClient;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildRawMessage(params: { from: string; to: string; subject: string; html: string }): string {
  const message = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    params.html,
  ].join('\r\n');

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
    throw new Error('Gmail API is not configured: set GMAIL_SENDER_EMAIL');
  }

  const client = getOAuthClient();
  const { token: accessToken } = await client.getAccessToken();
  if (!accessToken) {
    throw new Error('Failed to obtain a Gmail API access token');
  }

  const raw = buildRawMessage({
    from: senderEmail,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });

  const response = await fetch(GMAIL_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gmail API request failed (${response.status}): ${errorBody}`);
  }
}
