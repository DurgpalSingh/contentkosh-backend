import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { CreateStudentDto, UpdateStudentDto } from '../dtos/student.dto';
import { StudentController } from '../controllers/student.controller';
import { StudentService } from '../services/student.service';
import {
    validateIdParam,
    authorizeStudentAccess,
    authorizeStudent,
    authorizeUserAccess,
} from '../middlewares/validation.middleware';

const router = Router();

// Initialize service and controller
const studentService = new StudentService();
const studentController = new StudentController(studentService);

// All routes require authentication
router.use(authenticate);

// ==================== STUDENT ROUTES ====================

/**
 * @swagger
 * /api/students/profile:
 *   post:
 *     summary: Create new student profile
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ['userId', 'businessId']
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID
 *               businessId:
 *                 type: integer
 *                 description: Business ID
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student profile created successfully
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
    validateDto(CreateStudentDto),
    authorizeStudentAccess,
    studentController.createStudent
);

/**
 * @swagger
 * /api/students/{studentId}:
 *   get:
 *     summary: Get student profile by student ID
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student profile fetched successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
    '/:studentId',
    validateIdParam('studentId'),
    authorizeStudent,
    studentController.getStudent
);

/**
 * @swagger
 * /api/students/user/{userId}:
 *   get:
 *     summary: Get student profile by user ID
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Student profile fetched successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.get(
    '/user/:userId',
    validateIdParam('userId'),
    authorizeUserAccess,
    studentController.getStudentByUserId
);

/**
 * @swagger
 * /api/students/{studentId}:
 *   put:
 *     summary: Update student profile
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dob:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               bio:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *     responses:
 *       200:
 *         description: Student profile updated successfully
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.put(
    '/:studentId',
    validateIdParam('studentId'),
    authorize(UserRole.ADMIN),
    authorizeStudentAccess,
    validateDto(UpdateStudentDto),
    studentController.updateStudent
);

export default router;
