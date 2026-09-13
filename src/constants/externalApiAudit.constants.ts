/**
 * Names of external services this backend calls outbound. Add a new entry here
 * whenever a new external integration starts being audited via ExternalApiAuditLog.
 */
export const EXTERNAL_API_SERVICE = {
  AI_AGENT: 'ai-agent',
} as const;

export type ExternalApiServiceName = (typeof EXTERNAL_API_SERVICE)[keyof typeof EXTERNAL_API_SERVICE];

export const EXTERNAL_API_ERROR_CODE = {
  TIMEOUT: 'TIMEOUT',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
