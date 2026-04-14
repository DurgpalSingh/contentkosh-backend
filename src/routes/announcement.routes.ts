import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getManagedAnnouncements,
  getMyAnnouncements,
  getUserAnnouncementBundle,
  updateAnnouncement,
} from '../controllers/announcement.controller';
import { authorize } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/announcements/my:
 *   get:
 *     summary: Get announcements targeted to the current user
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User-specific announcements fetched successfully
 *       403:
 *         description: Forbidden
 */
router.get('/my', getMyAnnouncements);

/**
 * @swagger
 * /api/announcements/user:
 *   get:
 *     summary: Get announcements for the current user (received + managed)
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Announcements fetched successfully
 *       403:
 *         description: Forbidden
 */
router.get('/user', getUserAnnouncementBundle);

/**
 * @swagger
 * /api/announcements/managed:
 *   get:
 *     summary: Get managed announcements for the current user
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Managed announcements fetched successfully
 *       403:
 *         description: Forbidden
 */
router.get(
  '/managed',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  getManagedAnnouncements,
);

/**
 * @swagger
 * /api/announcements:
 *   post:
 *     summary: Create a new announcement
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAnnouncementRequest'
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  createAnnouncement,
);

/**
 * @swagger
 * /api/announcements/{id}:
 *   get:
 *     summary: Get a single announcement by ID
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Announcement ID
 *     responses:
 *       200:
 *         description: Announcement fetched successfully
 *       404:
 *         description: Announcement not found
 */
router.get('/:id', getAnnouncementById);

/**
 * @swagger
 * /api/announcements/{id}:
 *   put:
 *     summary: Update an existing announcement
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Announcement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnouncementRequest'
 *     responses:
 *       200:
 *         description: Announcement updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Announcement not found
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  updateAnnouncement,
);

/**
 * @swagger
 * /api/announcements/{id}:
 *   delete:
 *     summary: Delete an announcement by ID
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Announcement ID
 *     responses:
 *       204:
 *         description: Announcement deleted successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Announcement not found
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.TEACHER),
  deleteAnnouncement,
);

export default router;
