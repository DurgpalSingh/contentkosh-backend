import { Router } from 'express';
import { createBusiness, getBusiness, updateBusiness, deleteBusiness, getBusinessBySlug } from '../controllers/business.controller';
import { createExam, getExamsByBusiness, getExam, updateExam, deleteExam } from '../controllers/exam.controller';
import { CreateExamDto, UpdateExamDto } from '../dtos/exam.dto';
import { authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { CreateBusinessDto, UpdateBusinessDto } from '../dtos/business.dto';
import { authorizeBusinessAccess, validateIdParam, validateStringIdParam } from '../middlewares/validation.middleware';
import {
  CreateExamTestDto,
  CreatePracticeTestDto,
  CreateQuestionDto,
  PublishExamTestRequestDto,
  PublishPracticeTestRequestDto,
  StartExamAttemptRequestDto,
  StartPracticeAttemptRequestDto,
  SubmitAttemptRequestDto,
  UpdateExamTestDto,
  UpdatePracticeTestDto,
  UpdateQuestionDto,
} from '../dtos/test.dto';
import { practiceTestController } from '../controllers/practice-test.controller';
import { examTestController } from '../controllers/exam-test.controller';

const router = Router();

// Update createBusiness swagger to remove ADMIN restriction description effectively (though still requires auth)
router.post('/', authorize(), createBusiness); // Allow any authenticated user to create a business

// Add route for slug
/**
 * @swagger
 * /api/business/slug/{slug}:
 *   get:
 *     summary: Get business by slug
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Business Slug
 *     responses:
 *       200:
 *         description: Business fetched successfully
 *       404:
 *         description: Business not found
 */
router.get('/slug/:slug', getBusinessBySlug);

router.get('/', authorize(UserRole.SUPERADMIN), getBusiness);
// ...

/**
 * @swagger
 * /api/business/{businessId}/exams:
 *   post:
 *     summary: Create exam under business
 *     tags: [Business, Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExamRequest'
 *     responses:
 *       201:
 *         description: Exam created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Exam'
 *       400:
 *         description: Invalid input data
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
router.post('/:businessId/exams', authorize(UserRole.ADMIN), validateDto(CreateExamDto), createExam);

/**
 * @swagger
 * /api/business/{businessId}/exams:
 *   get:
 *     summary: List exams for a business
 *     tags: [Business, Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Exams fetched successfully
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
 *                         $ref: '#/components/schemas/Exam'
 *       400:
 *         description: Invalid Business ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Business not found
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
router.get('/:businessId/exams', authorize(), getExamsByBusiness);
/**
 * @swagger
 * /api/business/{businessId}/exams/{id}:
 *   get:
 *     summary: Get exam by ID under a business
 *     tags: [Business, Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to select
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *         description: Comma-separated list of relations to include
 *     responses:
 *       200:
 *         description: Exam fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Exam'
 *       404:
 *         description: Exam not found
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
 *   put:
 *     summary: Update exam under a business
 *     tags: [Business, Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateExamRequest'
 *     responses:
 *       200:
 *         description: Exam updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Exam'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Exam name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Exam not found
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
 *   delete:
 *     summary: Delete exam under a business
 *     tags: [Business, Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Exam ID
 *     responses:
 *       200:
 *         description: Exam deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *       404:
 *         description: Exam not found
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
router.get('/:businessId/exams/:id', getExam);
router.put('/:businessId/exams/:id', authorize(UserRole.ADMIN), validateDto(UpdateExamDto, true), updateExam);
router.delete('/:businessId/exams/:id', authorize(UserRole.ADMIN), deleteExam);

// ==================== LMS PRACTICE TEST ROUTES ====================
router.post(
  '/:businessId/practice-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(CreatePracticeTestDto),
  practiceTestController.create,
);

router.get(
  '/:businessId/practice-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  practiceTestController.list,
);

router.get(
  '/:businessId/practice-tests/available',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  practiceTestController.available,
);

router.get(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.get,
);

router.put(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  validateDto(UpdatePracticeTestDto, true),
  practiceTestController.update,
);

router.delete(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.remove,
);

router.post(
  '/:businessId/practice-tests/publish',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(PublishPracticeTestRequestDto),
  practiceTestController.publish,
);

router.get(
  '/:businessId/practice-tests/:practiceTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.listQuestions,
);

router.post(
  '/:businessId/practice-tests/:practiceTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  validateDto(CreateQuestionDto),
  practiceTestController.createQuestion,
);

router.put(
  '/:businessId/practice-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  validateDto(UpdateQuestionDto, true),
  practiceTestController.updateQuestion,
);

router.delete(
  '/:businessId/practice-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  practiceTestController.deleteQuestion,
);

// ==================== PRACTICE ANALYTICS ====================
router.get(
  '/:businessId/practice-tests/:practiceTestId/analytics',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.analytics,
);

router.get(
  '/:businessId/practice-tests/:practiceTestId/analytics/export',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.exportAnalytics,
);

// ==================== LMS EXAM TEST ROUTES ====================
router.post(
  '/:businessId/exam-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(CreateExamTestDto),
  examTestController.create,
);

router.get(
  '/:businessId/exam-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  examTestController.list,
);

router.get(
  '/:businessId/exam-tests/available',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  examTestController.available,
);

router.get(
  '/:businessId/exam-tests/:examTestId',
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.get,
);

router.put(
  '/:businessId/exam-tests/:examTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  validateDto(UpdateExamTestDto, true),
  examTestController.update,
);

router.delete(
  '/:businessId/exam-tests/:examTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.remove,
);

router.post(
  '/:businessId/exam-tests/publish',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(PublishExamTestRequestDto),
  examTestController.publish,
);

router.get(
  '/:businessId/exam-tests/:examTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.listQuestions,
);

router.post(
  '/:businessId/exam-tests/:examTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  validateDto(CreateQuestionDto),
  examTestController.createQuestion,
);

router.put(
  '/:businessId/exam-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  validateDto(UpdateQuestionDto, true),
  examTestController.updateQuestion,
);

router.delete(
  '/:businessId/exam-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  examTestController.deleteQuestion,
);

// ==================== EXAM ANALYTICS ====================
router.get(
  '/:businessId/exam-tests/:examTestId/analytics',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.analytics,
);

router.get(
  '/:businessId/exam-tests/:examTestId/analytics/export',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.exportAnalytics,
);

// ==================== LMS ATTEMPT ROUTES (STUDENT) ====================
router.post(
  '/:businessId/practice-tests/attempts',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateDto(StartPracticeAttemptRequestDto),
  practiceTestController.startAttempt,
);

router.get(
  '/:businessId/practice-tests/attempts/:attemptId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  practiceTestController.getAttempt,
);

router.post(
  '/:businessId/practice-tests/attempts/:attemptId/submit',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  validateDto(SubmitAttemptRequestDto),
  practiceTestController.submitAttempt,
);

router.post(
  '/:businessId/exam-tests/attempts',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateDto(StartExamAttemptRequestDto),
  examTestController.startAttempt,
);

router.get(
  '/:businessId/exam-tests/attempts/:attemptId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  examTestController.getAttempt,
);

router.post(
  '/:businessId/exam-tests/attempts/:attemptId/submit',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  validateDto(SubmitAttemptRequestDto),
  examTestController.submitAttempt,
);

// ==================== BUSINESS ROUTES ====================

/**
 * @swagger
 * /api/business:
 *   post:
 *     summary: Create business configuration
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBusinessRequest'
 *     responses:
 *       201:
 *         description: Business created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Business'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Business configuration already exists
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
router.post('/', authorize(), validateDto(CreateBusinessDto), createBusiness);

/**
 * @swagger
 * /api/business:
 *   get:
 *     summary: Get business configuration
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Business'
 *       404:
 *         description: No business configuration found
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
router.get('/', authorize(UserRole.SUPERADMIN), getBusiness);

/**
 * @swagger
 * /api/business/{id}:
 *   get:
 *     summary: Get business configuration by ID
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Business fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Business'
 *       404:
 *         description: Business not found
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
router.get('/:id', getBusiness);

/**
 * @swagger
 * /api/business/{id}:
 *   put:
 *     summary: Update business configuration
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBusinessRequest'
 *     responses:
 *       200:
 *         description: Business updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Business'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Business not found
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
router.put('/:id', authorize(UserRole.ADMIN), validateDto(UpdateBusinessDto, true), updateBusiness);

/**
 * @swagger
 * /api/business/{id}:
 *   delete:
 *     summary: Delete business configuration
 *     tags: [Business]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Business ID
 *     responses:
 *       200:
 *         description: Business deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: null
 *       404:
 *         description: Business not found
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
router.delete('/:id', authorize(UserRole.ADMIN), deleteBusiness);

export default router;
