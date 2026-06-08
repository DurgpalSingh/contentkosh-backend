import { Router } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadEditorImage, deleteEditorImage } from '../controllers/editorImage.controller';
import { BadRequestError } from '../errors/api.errors';

const EDITOR_IMAGE_TEMP_DIR = 'uploads/editor/tmp';

// Ensure temp dir exists
try {
  if (!fs.existsSync(EDITOR_IMAGE_TEMP_DIR)) {
    fs.mkdirSync(EDITOR_IMAGE_TEMP_DIR, { recursive: true });
  }
} catch { /* ignore */ }

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (pre-compression client size)

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, EDITOR_IMAGE_TEMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
  },
});

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
router.post('/editor/image', authenticate, upload.single('image'), uploadEditorImage);
router.delete('/editor/image', authenticate, deleteEditorImage);

export default router;
