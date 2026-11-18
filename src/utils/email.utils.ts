/** Splits a comma separated list of emails (as stored in env vars) into trimmed, non-empty addresses. */
export function parseEmailList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}
