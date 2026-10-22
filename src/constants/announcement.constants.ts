export const ANNOUNCEMENT_SOCKET_EVENTS = {
  NEW: 'announcement:new',
  UPDATED: 'announcement:updated',
  DELETED: 'announcement:deleted',
  UNAUTHORIZED: 'unauthorized',
} as const;

export const ANNOUNCEMENT_SOCKET_ROOMS = {
  business: (businessId: number) => `business:${businessId}`,
  batch: (batchId: number) => `batch:${batchId}`,
} as const;

/** Max length for heading / content (defense in depth; validate in service too). */
export const ANNOUNCEMENT_MAX_HEADING_LENGTH = 500;
export const ANNOUNCEMENT_MAX_CONTENT_LENGTH = 20000;

/** Prisma field names for role-based visibility flags. */
export const VISIBILITY_FIELD_ADMINS = 'visibleToAdmins';
export const VISIBILITY_FIELD_TEACHERS = 'visibleToTeachers';
export const VISIBILITY_FIELD_STUDENTS = 'visibleToStudents';

/**
 * FCM topic names for announcement push. The mobile app subscribes with the same names
 * (contentkosh-mobile/src/constants/pushTopics.ts) — keep both in sync.
 */
export const ANNOUNCEMENT_PUSH_TOPICS = {
  admins: (prefix: string, businessId: number) => `${prefix}-b${businessId}-admins`,
  allMembers: (prefix: string, businessId: number, role: 'teachers' | 'students') => `${prefix}-b${businessId}-${role}-all`,
  batchMembers: (prefix: string, businessId: number, batchId: number, role: 'teachers' | 'students') =>
    `${prefix}-b${businessId}-batch${batchId}-${role}`,
} as const;
