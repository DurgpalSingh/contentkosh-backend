import { Router } from 'express';
import { getCoursesByBusiness } from '../controllers/course.controller';

const router = Router();

/**
 * @swagger
 * /api/courses/business/{businessId}:
 *   get:
 *     summary: Get all courses for a business
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true for active only, false for all)
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 *       400:
 *         description: Invalid business ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/business/:businessId', getCoursesByBusiness);

export default router;
