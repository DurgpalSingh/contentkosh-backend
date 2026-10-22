/**
 * Mobile (Android) push notifications sent through Firebase Cloud Messaging to topics.
 * Phones subscribe to topics for their business/role/batches, so no device tokens are stored here.
 * Push is skipped (with a log line) until the three Firebase service-account values are set.
 */
const readEnv = (key: string) => process.env[key]?.trim() || '';

export const pushConfig = {
  firebase: {
    projectId: readEnv('FIREBASE_PROJECT_ID'),
    clientEmail: readEnv('FIREBASE_CLIENT_EMAIL'),
    // Env files store the key on one line with literal "\n" sequences.
    privateKey: readEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },
  /** Keeps topics of different environments (UAT/prod) apart when they share a Firebase project; must match the app. */
  topicPrefix: readEnv('PUSH_TOPIC_PREFIX') || 'ck',
  /** Android notification channel created by the app; it plays the default system sound. */
  androidChannelId: 'announcements',
  /** FCM conditions accept at most 5 topics. */
  maxTopicsPerCondition: 5,
  bodyMaxLength: 160,
  /** How often to look for scheduled announcements that just went live. */
  scheduledStartCron: '* * * * *',
};

export const isPushConfigured = (): boolean =>
  Boolean(pushConfig.firebase.projectId && pushConfig.firebase.clientEmail && pushConfig.firebase.privateKey);
