import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadEditorImageFile } from '../middlewares/upload.middleware';
import { uploadEditorImage, deleteEditorImage } from '../controllers/editorImage.controller';

const router = Router();

/**
 * @swagger
 * /api/editor/image:
 *   post:
 *     summary: Upload an image for the rich-text editor
 *     tags: [Editor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Image uploaded — returns { url }
 *       400:
 *         description: Validation error
 *   delete:
 *     summary: Delete a previously uploaded editor image
 *     tags: [Editor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 example: /uploads/editor/editor-123.webp
 *     responses:
 *       200:
 *         description: Image deleted
 *       400:
 *         description: Validation error
 */
router.post('/editor/image', authenticate, uploadEditorImageFile, uploadEditorImage);
router.delete('/editor/image', authenticate, deleteEditorImage);

export default router;
