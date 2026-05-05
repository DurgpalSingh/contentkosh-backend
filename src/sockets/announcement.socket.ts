import type { Server, Socket } from 'socket.io';
import { config } from '../config/config';
import { ANNOUNCEMENT_SOCKET_EVENTS, ANNOUNCEMENT_SOCKET_ROOMS } from '../constants/announcement.constants';
import { findActiveBatchIdsForUser } from '../repositories/batch.repo';
import { AuthService } from '../services/auth.service';
import { setAnnouncementIo } from './announcementEmitter';
import logger from '../utils/logger';

function getTokenFromSocket(socket: Socket): string | undefined {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) {
    return fromAuth;
  }
  const headerAuth = socket.handshake.headers.authorization;
  if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
    return headerAuth.slice('Bearer '.length).trim();
  }
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  const name = `${config.cookies.accessCookieName}=`;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name)) {
      return decodeURIComponent(trimmed.slice(name.length));
    }
  }
  return undefined;
}

export function registerAnnouncementSocket(io: Server): void {
  setAnnouncementIo(io);
  logger.info('[announcement-socket] registerAnnouncementSocket initialized');

  io.on('connection', async (socket: Socket) => {
    const token = getTokenFromSocket(socket);
    if (!token) {
      logger.warn('[announcement-socket] connection rejected: no token');
      socket.emit(ANNOUNCEMENT_SOCKET_EVENTS.UNAUTHORIZED, { message: 'No token' });
      socket.disconnect(true);
      return;
    }

    const user = AuthService.verifyAccessToken(token);
    if (!user) {
      logger.warn('[announcement-socket] connection rejected: invalid token');
      socket.emit(ANNOUNCEMENT_SOCKET_EVENTS.UNAUTHORIZED, { message: 'Invalid token' });
      socket.disconnect(true);
      return;
    }

    const businessId = user.businessId;
    socket.join(ANNOUNCEMENT_SOCKET_ROOMS.business(businessId!));

    const batchIds = await findActiveBatchIdsForUser(businessId!, user.id);
    for (const batchId of batchIds) {
      socket.join(ANNOUNCEMENT_SOCKET_ROOMS.batch(batchId));
    }

    logger.info(
      `[announcement-socket] connected userId=${user.id} businessId=${businessId} batchRooms=${batchIds.length}`,
    );

    socket.on('disconnect', (reason) => {
      logger.info(`[announcement-socket] disconnected userId=${user.id} reason=${reason}`);
    });
  });
}
