import fs from 'fs';

export const SECRET_FILE_ERRORS = {
  UNREADABLE: 'Secret file could not be read',
  INVALID_JSON: 'Secret file must contain valid JSON',
  MISSING_KEY: 'Secret file does not contain a non-empty string for the requested key',
} as const;

/**
 * Reads one string value from a JSON secrets file kept outside the project folder,
 * e.g. { "SMTP_PASSWORD": "..." }. Only the file path (never the secret) lives in env.
 */
export function readSecretFromFile(filePath: string, key: string): string {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`${SECRET_FILE_ERRORS.UNREADABLE}: ${filePath}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${SECRET_FILE_ERRORS.INVALID_JSON}: ${filePath}`);
  }

  const value = parsed[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`${SECRET_FILE_ERRORS.MISSING_KEY} (${key}): ${filePath}`);
  }
  return value;
}
