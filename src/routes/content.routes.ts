import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateIdParam, authorizeContentAccess, authorizeContentCreation } from '../middlewares/validation.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { CreateContentDto, UpdateContentDto } from '../dtos/content.dto';
import { contentController } from '../controllers/content.controller';
import { uploadSingleFile, validateFileSize, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== CONTENT CRUD ROUTES ====================

/**
 * @swagger
 * /api/batches/{batchId}/contents:
 *   post:
 *     summary: Create new content for a batch
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: ['file', 'title']
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (PDF or Image)
 *               title:
 *                 type: string
 *                 description: Title of the content
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 description: Status of the content
 *     responses:
 *       201:
 *         description: Content created successfully
 *       400:
 *         description: Invalid input data or file validation failed
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/batches/:batchId/contents',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('batchId'),
  authorizeContentCreation,
  uploadSingleFile,
  handleUploadError,
  validateFileSize,
  validateDto(CreateContentDto),
  contentController.createContent
);

/**
 * @swagger
 * /api/batches/{batchId}/contents:
 *   get:
 *     summary: Get all contents for a batch
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PDF, IMAGE]
 *         description: Filter by content type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         description: Filter by content status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in content titles
 *     responses:
 *       200:
 *         description: Contents fetched successfully
 *       400:
 *         description: Invalid batch ID
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/batches/:batchId/contents',
  validateIdParam('batchId'),
  authorizeContentCreation,
  contentController.getContentsByBatch
);

/**
 * @swagger
 * /api/contents/{contentId}:
 *   get:
 *     summary: Get content by ID
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content fetched successfully
 *       400:
 *         description: Invalid content ID
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/contents/:contentId',
  validateIdParam('contentId'),
  authorizeContentAccess,
  contentController.getContent
);

/**
 * @swagger
 * /api/contents/{contentId}/file:
 *   get:
 *     summary: Download/view content file
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     responses:
 *       200:
 *         description: File streamed successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid content ID
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content or file not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/contents/:contentId/file',
  validateIdParam('contentId'),
  authorizeContentAccess,
  contentController.getContentFile
);

/**
 * @swagger
 * /api/contents/{contentId}:
 *   put:
 *     summary: Update content
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateContentRequest'
 *     responses:
 *       200:
 *         description: Content updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/contents/:contentId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('contentId'),
  authorizeContentAccess,
  validateDto(UpdateContentDto),
  contentController.updateContent
);

/**
 * @swagger
 * /api/contents/{contentId}:
 *   delete:
 *     summary: Delete content
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Content ID
 *     responses:
 *       200:
 *         description: Content deleted successfully
 *       400:
 *         description: Invalid content ID
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Content not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/contents/:contentId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('contentId'),
  authorizeContentAccess,
  contentController.deleteContent
);

export default router;