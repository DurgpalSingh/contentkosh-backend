import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getManagedAnnouncements,
  getMyAnnouncements,
  updateAnnouncement,
} from '../controllers/announcement.controller';
import { authorize } from '../middlewares/auth.middleware';

const router = Router();

/** Inbox: filtered by role + targeting */
router.get('/my', getMyAnnouncements);

/** Admin: all in business; teacher: own only */
router.get(
  '/managed',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  getManagedAnnouncements,
);

router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  createAnnouncement,
);

router.get('/:id', getAnnouncementById);

router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  updateAnnouncement,
);

router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  deleteAnnouncement,
);

export default router;
