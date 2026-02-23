import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get dashboard data based on user role
 *     description: Returns role-specific dashboard data (Admin, Teacher, or Student)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/AdminDashboard'
 *                         - $ref: '#/components/schemas/TeacherDashboard'
 *                         - $ref: '#/components/schemas/StudentDashboard'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Dashboard not available for your role
 */
router.get('/dashboard', authenticate, getDashboard);

export default router;
