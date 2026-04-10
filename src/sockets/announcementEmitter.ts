import type { Server } from 'socket.io';
import { ANNOUNCEMENT_SOCKET_EVENTS, ANNOUNCEMENT_SOCKET_ROOMS } from '../constants/announcement.constants';
import logger from '../utils/logger';

let ioRef: Server | null = null;

export function setAnnouncementIo(io: Server): void {
  ioRef = io;
}

export interface AnnouncementSocketPayload {
  id: number;
  businessId: number;
}

export function emitAnnouncementCreated(
  businessId: number,
  batchIds: number[],
  payload: AnnouncementSocketPayload,
): void {
  if (!ioRef) {
    logger.warn('[announcement-socket] emit skipped: io not initialized');
    return;
  }
  try {
    ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.business(businessId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.NEW, payload);
    const uniqueBatches = [...new Set(batchIds)];
    for (const batchId of uniqueBatches) {
      ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.batch(batchId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.NEW, payload);
    }
    logger.info(
      `[announcement-socket] emitted NEW id=${payload.id} businessId=${businessId} batchRooms=${uniqueBatches.length}`,
    );
  } catch (e) {
    logger.error('[announcement-socket] emit NEW failed', e);
  }
}

export function emitAnnouncementUpdated(
  businessId: number,
  batchIds: number[],
  payload: AnnouncementSocketPayload,
): void {
  if (!ioRef) {
    logger.warn('[announcement-socket] emit skipped: io not initialized');
    return;
  }
  try {
    ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.business(businessId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.UPDATED, payload);
    const uniqueBatches = [...new Set(batchIds)];
    for (const batchId of uniqueBatches) {
      ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.batch(batchId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.UPDATED, payload);
    }
    logger.info(
      `[announcement-socket] emitted UPDATED id=${payload.id} businessId=${businessId} batchRooms=${uniqueBatches.length}`,
    );
  } catch (e) {
    logger.error('[announcement-socket] emit UPDATED failed', e);
  }
}

export function emitAnnouncementDeleted(
  businessId: number,
  batchIds: number[],
  payload: AnnouncementSocketPayload,
): void {
  if (!ioRef) {
    logger.warn('[announcement-socket] emit skipped: io not initialized');
    return;
  }
  try {
    ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.business(businessId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.DELETED, payload);
    const uniqueBatches = [...new Set(batchIds)];
    for (const batchId of uniqueBatches) {
      ioRef.to(ANNOUNCEMENT_SOCKET_ROOMS.batch(batchId)).emit(ANNOUNCEMENT_SOCKET_EVENTS.DELETED, payload);
    }
    logger.info(
      `[announcement-socket] emitted DELETED id=${payload.id} businessId=${businessId} batchRooms=${uniqueBatches.length}`,
    );
  } catch (e) {
    logger.error('[announcement-socket] emit DELETED failed', e);
  }
}
