import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { validateIdParam } from '../middlewares/validation.middleware';
import { UpdateBusinessStatusDto } from '../dtos/businessAdmin.dto';
import {
  listBusinesses,
  getBusinessDetail,
  updateBusinessStatus,
} from '../controllers/businessAdmin.controller';

const router = Router();

router.use(authorize(UserRole.SUPERADMIN));

/**
 * @swagger
 * /api/superadmin/businesses:
 *   get:
 *     summary: List all businesses on the platform (Super Admin only)
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, PAUSED, DELETED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches against institute name or slug
 *     responses:
 *       200:
 *         description: Businesses fetched successfully
 *       403:
 *         description: Forbidden - Super Admin only
 */
router.get('/businesses', listBusinesses);

/**
 * @swagger
 * /api/superadmin/businesses/{id}:
 *   get:
 *     summary: Get a single business's detail (Super Admin only)
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Business fetched successfully
 *       404:
 *         description: Business not found
 */
router.get('/businesses/:id', validateIdParam(), getBusinessDetail);

/**
 * @swagger
 * /api/superadmin/businesses/{id}/status:
 *   patch:
 *     summary: Pause, resume, or soft-delete a business (Super Admin only)
 *     description: >
 *       Single endpoint for every business lifecycle transition. Set `status` to PAUSED or
 *       DELETED to block that business's users from logging in / using the platform (a
 *       `reason` is required in both cases and is shown to the business's users). Set
 *       `status` to ACTIVE to resume - this immediately restores access.
 *     tags: [SuperAdmin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, PAUSED, DELETED]
 *               reason:
 *                 type: string
 *                 description: Required when status is PAUSED or DELETED
 *     responses:
 *       200:
 *         description: Business status updated successfully
 *       400:
 *         description: Invalid input data / missing reason
 *       404:
 *         description: Business not found
 */
router.patch('/businesses/:id/status', validateIdParam(), validateDto(UpdateBusinessStatusDto), updateBusinessStatus);

export default router;
