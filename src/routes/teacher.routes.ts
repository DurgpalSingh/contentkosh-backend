import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { CreateTeacherDto, UpdateTeacherDto } from '../dtos/teacher.dto';
import { TeacherController } from '../controllers/teacher.controller';
import { TeacherService } from '../services/teacher.service';
import { validateIdParam } from '../middlewares/validation.middleware';

const router = Router();

// Initialize service and controller
const teacherService = new TeacherService();
const teacherController = new TeacherController(teacherService);

// All routes require authentication
router.use(authenticate);

// ==================== TEACHER ROUTES ====================

/**
 * @swagger
 * /api/teachers/profile:
 *   post:
 *     summary: Create new teacher profile
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ['userId', 'businessId', 'professional']
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               businessId:
 *                 type: integer
 *                 description: Business ID
 *               professional:
 *                 type: object
 *                 required: ['qualification', 'experienceYears', 'designation']
 *                 properties:
 *                   qualification:
 *                     type: string
 *                   experienceYears:
 *                     type: integer
 *                   designation:
 *                     type: string
 *                   bio:
 *                     type: string
 *                   languages:
 *                     type: array
 *                     items:
 *                       type: string
 *               personal:
 *                 type: object
 *                 properties:
 *                   gender:
 *                     type: string
 *                   dob:
 *                     type: string
 *                     format: date
 *                   address:
 *                     type: string
 *     responses:
 *       201:
 *         description: Teacher profile created successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
    '/profile',
    authorize(UserRole.ADMIN),
    validateDto(CreateTeacherDto),
    teacherController.createTeacher
);

/**
 * @swagger
 * /api/teachers/{teacherId}:
 *   get:
 *     summary: Get teacher profile by teacher ID
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Teacher ID
 *     responses:
 *       200:
 *         description: Teacher profile fetched successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Teacher profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
    '/:teacherId',
    validateIdParam('teacherId'),
    teacherController.getTeacher
);

/**
 * @swagger
 * /api/teachers/{teacherId}:
 *   put:
 *     summary: Update teacher profile
 *     tags: [Teacher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Teacher ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professional:
 *                 type: object
 *                 properties:
 *                   qualification:
 *                     type: string
 *                   experienceYears:
 *                     type: integer
 *                   designation:
 *                     type: string
 *                   bio:
 *                     type: string
 *                   languages:
 *                     type: array
 *                     items:
 *                       type: string
 *               personal:
 *                 type: object
 *                 properties:
 *                   gender:
 *                     type: string
 *                   dob:
 *                     type: string
 *                     format: date
 *                   address:
 *                     type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *     responses:
 *       200:
 *         description: Teacher profile updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Teacher profile not found
 *       500:
 *         description: Internal server error
 */
router.put(
    '/:teacherId',
    validateDto(UpdateTeacherDto),
    authorize(UserRole.ADMIN),
    validateIdParam('teacherId'),
    teacherController.updateTeacher
);

export default router;
