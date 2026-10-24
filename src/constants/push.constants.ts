export const FCM_API = {
  SCOPE: 'https://www.googleapis.com/auth/firebase.messaging',
  sendEndpoint: (projectId: string) => `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
} as const;

export const FCM_REQUEST = {
  AUTH_SCHEME: 'Bearer',
  CONTENT_TYPE_JSON: 'application/json',
  ANDROID_PRIORITY: 'HIGH',
  NOTIFICATION_SOUND: 'default',
} as const;

/** FCM condition syntax: `'a' in topics || 'b' in topics`. */
export const FCM_TOPIC_CONDITION = {
  topicClause: (topic: string) => `'${topic}' in topics`,
  OR_SEPARATOR: ' || ',
} as const;

export const PUSH_LOG_TAG = '[push]';

export const PUSH_ERROR_MESSAGES = {
  NOT_CONFIGURED: 'skipped: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set',
  MISSING_ACCESS_TOKEN: 'No FCM access token',
  SEND_FAILED_PREFIX: 'FCM',
} as const;

export const ANNOUNCEMENT_PUSH_KIND = {
  CREATED: 'created',
  UPDATED: 'updated',
  STARTED: 'started',
} as const;

export type AnnouncementPushKind = (typeof ANNOUNCEMENT_PUSH_KIND)[keyof typeof ANNOUNCEMENT_PUSH_KIND];
export type AnnouncementSaveKind = typeof ANNOUNCEMENT_PUSH_KIND.CREATED | typeof ANNOUNCEMENT_PUSH_KIND.UPDATED;

export const ANNOUNCEMENT_PUSH_CONTENT = {
  /** `type` in the data payload; the app routes taps on it to the announcement screen. */
  DATA_TYPE: 'announcement',
  UPDATED_TITLE_PREFIX: 'Updated: ',
  TRUNCATION_SUFFIX: '…',
} as const;
