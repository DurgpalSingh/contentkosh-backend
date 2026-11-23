import { Router } from 'express';
import logger from '../utils/logger';
import { config } from '../config/config';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Check if the API is running
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: API is running
 *                 environment:
 *                   type: string
 *                   example: uat
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-08-13T21:00:20.079Z
 */
router.get('/health', (req, res) => {
    logger.info('Health check route called');
    res.json({
      success: true,
      message: 'API is running',
      environment: config.server.appEnv,
      timestamp: new Date().toISOString()
    });
  });

export default router;