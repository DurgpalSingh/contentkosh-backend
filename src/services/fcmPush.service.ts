import { JWT } from 'google-auth-library';
import { isPushConfigured, pushConfig } from '../config/push.config';
import logger from '../utils/logger';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export type TopicPushMessage = {
  title: string;
  body: string;
  /** String-only key/values delivered to the app (FCM requirement). */
  data: Record<string, string>;
};

let authClient: JWT | null = null;
let warnedNotConfigured = false;

function getAuthClient(): JWT {
  if (!authClient) {
    authClient = new JWT({
      email: pushConfig.firebase.clientEmail,
      key: pushConfig.firebase.privateKey,
      scopes: [FCM_SCOPE],
    });
  }
  return authClient;
}

/** `'a' in topics || 'b' in topics` — a device subscribed to several of them still gets one notification. */
function buildTopicCondition(topics: string[]): string {
  return topics.map((topic) => `'${topic}' in topics`).join(' || ');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function sendToCondition(condition: string, message: TopicPushMessage, accessToken: string): Promise<void> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${pushConfig.firebase.projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          condition,
          notification: { title: message.title, body: message.body },
          data: message.data,
          android: {
            priority: 'HIGH',
            notification: { channel_id: pushConfig.androidChannelId, sound: 'default' },
          },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`FCM ${response.status}: ${await response.text()}`);
  }
}

export const fcmPushService = {
  /**
   * Sends one notification to everyone subscribed to any of `topics`. Never throws: push is a
   * side effect of saving an announcement and must not fail that request.
   */
  async sendToTopics(topics: string[], message: TopicPushMessage): Promise<void> {
    const uniqueTopics = [...new Set(topics)];
    if (uniqueTopics.length === 0) return;
    if (!isPushConfigured()) {
      if (!warnedNotConfigured) {
        logger.warn('[push] skipped: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set');
        warnedNotConfigured = true;
      }
      return;
    }

    try {
      const { token } = await getAuthClient().getAccessToken();
      if (!token) throw new Error('No FCM access token');
      // Topics beyond 5 go out in extra messages; a user in batches split across messages may get it twice.
      const conditions = chunk(uniqueTopics, pushConfig.maxTopicsPerCondition).map(buildTopicCondition);
      const results = await Promise.allSettled(conditions.map((condition) => sendToCondition(condition, message, token)));
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      failed.forEach((failure) => logger.error(`[push] send failed: ${(failure.reason as Error).message}`));
      logger.info(`[push] sent topics=${uniqueTopics.length} messages=${conditions.length} failed=${failed.length}`);
    } catch (error) {
      logger.error(`[push] send failed: ${(error as Error).message}`);
    }
  },
};
