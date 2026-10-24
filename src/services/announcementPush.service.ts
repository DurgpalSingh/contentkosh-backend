import { AnnouncementScope } from '@prisma/client';
import {
  ANNOUNCEMENT_PUSH_MEMBER_ROLES,
  ANNOUNCEMENT_PUSH_TOPICS,
  AnnouncementPushMemberRole,
} from '../constants/announcement.constants';
import {
  ANNOUNCEMENT_PUSH_CONTENT,
  ANNOUNCEMENT_PUSH_KIND,
  AnnouncementPushKind,
  AnnouncementSaveKind,
  PUSH_LOG_TAG,
} from '../constants/push.constants';
import { pushConfig } from '../config/push.config';
import { requestContext } from '../contexts/request-context';
import * as announcementRepo from '../repositories/announcement.repo';
import * as businessRepo from '../repositories/business.repo';
import { fcmPushService } from './fcmPush.service';
import logger from '../utils/logger';

type AnnouncementForPush = {
  id: number;
  heading: string;
  content: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  visibleToAdmins: boolean;
  visibleToTeachers: boolean;
  visibleToStudents: boolean;
  scope: AnnouncementScope;
  targetAllCourses: boolean;
  targetAllBatches: boolean;
  targets: Array<{ courseId: number | null; batchId: number | null }>;
};

function isLiveNow(announcement: AnnouncementForPush, now = new Date()): boolean {
  return announcement.isActive && announcement.startDate <= now && announcement.endDate >= now;
}

function truncate(text: string, max: number): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  const suffix = ANNOUNCEMENT_PUSH_CONTENT.TRUNCATION_SUFFIX;
  return singleLine.length > max ? `${singleLine.slice(0, max - suffix.length)}${suffix}` : singleLine;
}

/**
 * Topics of everyone who sees this announcement in their list — the same audience rules as
 * findUserAnnouncementBundle: admins, all teachers/students when it targets everyone, otherwise the
 * members of the targeted batches (course targets resolve to that course's batches).
 */
async function topicsForAnnouncement(businessId: number, announcement: AnnouncementForPush): Promise<string[]> {
  const prefix = pushConfig.topicPrefix;
  const topics: string[] = [];
  if (announcement.visibleToAdmins) topics.push(ANNOUNCEMENT_PUSH_TOPICS.admins(prefix, businessId));

  const memberRoles: AnnouncementPushMemberRole[] = [];
  if (announcement.visibleToTeachers) memberRoles.push(ANNOUNCEMENT_PUSH_MEMBER_ROLES.TEACHERS);
  if (announcement.visibleToStudents) memberRoles.push(ANNOUNCEMENT_PUSH_MEMBER_ROLES.STUDENTS);
  if (memberRoles.length === 0) return topics;

  const targetsEveryone =
    (announcement.scope === AnnouncementScope.COURSE && announcement.targetAllCourses) ||
    (announcement.scope === AnnouncementScope.BATCH && announcement.targetAllBatches);
  if (targetsEveryone) {
    memberRoles.forEach((role) => topics.push(ANNOUNCEMENT_PUSH_TOPICS.allMembers(prefix, businessId, role)));
    return topics;
  }

  const batchIds = await announcementRepo.resolveBatchIdsForEmit(businessId, announcement);
  for (const batchId of batchIds) {
    memberRoles.forEach((role) => topics.push(ANNOUNCEMENT_PUSH_TOPICS.batchMembers(prefix, businessId, batchId, role)));
  }
  return topics;
}

function buildPushTitle(heading: string, kind: AnnouncementPushKind): string {
  return kind === ANNOUNCEMENT_PUSH_KIND.UPDATED ? `${ANNOUNCEMENT_PUSH_CONTENT.UPDATED_TITLE_PREFIX}${heading}` : heading;
}

async function sendAnnouncementPush(
  businessId: number,
  announcement: AnnouncementForPush,
  kind: AnnouncementPushKind,
): Promise<void> {
  const topics = await topicsForAnnouncement(businessId, announcement);
  logger.info(`${PUSH_LOG_TAG} announcement id=${announcement.id} kind=${kind} businessId=${businessId} topics=${topics.length}`);
  await fcmPushService.sendToTopics(topics, {
    title: buildPushTitle(announcement.heading, kind),
    body: truncate(announcement.content, pushConfig.bodyMaxLength),
    data: {
      type: ANNOUNCEMENT_PUSH_CONTENT.DATA_TYPE,
      announcementId: String(announcement.id), businessId: String(businessId),
    },
  });
}

/** Last time the scheduled-start check ran; starts at boot so a restart never re-sends old ones. */
let lastScheduledCheckAt = new Date();

export const announcementPushService = {
  /**
   * Push for a just-created/updated announcement, only if it is live right now (future ones are
   * sent by the scheduled check when they start). Runs in the background and never throws.
   */
  notifySaved(businessId: number, announcement: AnnouncementForPush, kind: AnnouncementSaveKind): void {
    if (!isLiveNow(announcement)) {
      logger.info(`${PUSH_LOG_TAG} announcement id=${announcement.id} kind=${kind} not live yet; push deferred to start time`);
      return;
    }
    sendAnnouncementPush(businessId, announcement, kind).catch((error) =>
      logger.error(`${PUSH_LOG_TAG} announcement id=${announcement.id} kind=${kind} failed: ${(error as Error).message}`),
    );
  },

  /** Pushes scheduled announcements whose start time passed since the previous run, tenant by tenant. */
  async notifyScheduledStarts(): Promise<void> {
    const windowStart = lastScheduledCheckAt;
    const windowEnd = new Date();
    lastScheduledCheckAt = windowEnd;

    const businesses = await businessRepo.findActiveBusinessesWithSchema();
    for (const business of businesses) {
      const tenant = { businessId: business.id, ...(business.slug ? { slug: business.slug } : {}), schemaName: business.schemaName! };
      try {
        await requestContext.run({ user: undefined, tenant }, async () => {
          const started = await announcementRepo.findAnnouncementsStartedBetween(business.id, windowStart, windowEnd);
          for (const announcement of started) {
            await sendAnnouncementPush(business.id, announcement, ANNOUNCEMENT_PUSH_KIND.STARTED);
          }
        });
      } catch (error) {
        logger.error(`${PUSH_LOG_TAG} scheduled start check failed businessId=${business.id}: ${(error as Error).message}`);
      }
    }
  },
};
