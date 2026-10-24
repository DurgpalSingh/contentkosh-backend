import { JWT } from 'google-auth-library';
import { isPushConfigured, pushConfig } from '../config/push.config';
import { HTTP_HEADERS } from '../constants/httpHeaders.constants';
import {
  FCM_API,
  FCM_REQUEST,
  FCM_TOPIC_CONDITION,
  PUSH_ERROR_MESSAGES,
  PUSH_LOG_TAG,
} from '../constants/push.constants';
import logger from '../utils/logger';

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
      scopes: [FCM_API.SCOPE],
    });
  }
  return authClient;
}

/** A device subscribed to several of the topics still gets one notification. */
function buildTopicCondition(topics: string[]): string {
  return topics.map(FCM_TOPIC_CONDITION.topicClause).join(FCM_TOPIC_CONDITION.OR_SEPARATOR);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function buildFcmRequestBody(condition: string, message: TopicPushMessage): string {
  return JSON.stringify({
    message: {
      condition,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: {
        priority: FCM_REQUEST.ANDROID_PRIORITY,
        notification: { channel_id: pushConfig.androidChannelId, sound: FCM_REQUEST.NOTIFICATION_SOUND },
      },
    },
  });
}

async function sendToCondition(condition: string, message: TopicPushMessage, accessToken: string): Promise<void> {
  const response = await fetch(FCM_API.sendEndpoint(pushConfig.firebase.projectId), {
    method: 'POST',
    headers: {
      [HTTP_HEADERS.AUTHORIZATION]: `${FCM_REQUEST.AUTH_SCHEME} ${accessToken}`,
      [HTTP_HEADERS.CONTENT_TYPE]: FCM_REQUEST.CONTENT_TYPE_JSON,
    },
    body: buildFcmRequestBody(condition, message),
  });
  if (!response.ok) {
    throw new Error(`${PUSH_ERROR_MESSAGES.SEND_FAILED_PREFIX} ${response.status}: ${await response.text()}`);
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
        logger.warn(`${PUSH_LOG_TAG} ${PUSH_ERROR_MESSAGES.NOT_CONFIGURED}`);
        warnedNotConfigured = true;
      }
      return;
    }

    try {
      const { token } = await getAuthClient().getAccessToken();
      if (!token) throw new Error(PUSH_ERROR_MESSAGES.MISSING_ACCESS_TOKEN);
      // Topics beyond the per-condition limit go out in extra messages; a user in batches split across messages may get it twice.
      const conditions = chunk(uniqueTopics, pushConfig.maxTopicsPerCondition).map(buildTopicCondition);
      const results = await Promise.allSettled(conditions.map((condition) => sendToCondition(condition, message, token)));
      const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      failed.forEach((failure) => logger.error(`${PUSH_LOG_TAG} send failed: ${(failure.reason as Error).message}`));
      logger.info(`${PUSH_LOG_TAG} sent topics=${uniqueTopics.length} messages=${conditions.length} failed=${failed.length}`);
    } catch (error) {
      logger.error(`${PUSH_LOG_TAG} send failed: ${(error as Error).message}`);
    }
  },
};
