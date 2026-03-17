import { Router } from 'express';
import { checkBusinessSlug } from '../controllers/business.controller';

const router = Router();

/**
 * @swagger
 * /api/business/slug/{slug}/exists:
 *   get:
 *     summary: Check if business slug exists
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Business slug to check
 *     responses:
 *       200:
 *         description: Slug check successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         exists:
 *                           type: boolean
 *       400:
 *         description: Invalid slug
 */
router.get('/slug/:slug/exists', checkBusinessSlug);

export default router;
