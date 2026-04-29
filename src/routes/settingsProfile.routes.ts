import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadProfileAssets, mapProfileUploadToSettingsPayload } from '../middlewares/upload.middleware';
import { getSettingsProfile, updateSettingsProfile } from '../controllers/settingsProfile.controller';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { UpdateSettingsProfileDto } from '../dtos/settingsProfile.dto';

const router = Router();

/**
 * @swagger
 * /api/settings/profile:
 *   get:
 *     summary: Get current user's settings profile
 *     tags: [Settings Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings profile fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User profile not found
 *   put:
 *     summary: Update current user's settings profile
 *     tags: [Settings Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               userDetails:
 *                 type: string
 *                 description: JSON string object for user details
 *               profileDetails:
 *                 type: string
 *                 description: JSON string object for teacher/student profile details
 *               businessDetails:
 *                 type: string
 *                 description: JSON string object for business details (admin only)
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *               businessLogo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Settings profile updated successfully
 *       400:
 *         description: Invalid request payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Profile not found
 */
router.get('/settings/profile', authenticate, getSettingsProfile);
router.put(
  '/settings/profile',
  authenticate,
  uploadProfileAssets,
  mapProfileUploadToSettingsPayload,
  validateDto(UpdateSettingsProfileDto, true),
  updateSettingsProfile
);

export default router;
