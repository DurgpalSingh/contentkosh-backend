import { Router } from 'express';
import { authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { validateDto } from '../middlewares/validation/dto.middleware';
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

// ==================== LMS PRACTICE TEST ROUTES ====================

// Static routes MUST come before parameterized routes to avoid Express matching
// "available", "publish", "attempts", "questions/:id" as :practiceTestId
/**
 * @swagger
 * /api/business/{businessId}/practice-tests/available:
 *   get:
 *     summary: Get available practice tests for the authenticated user
 *     tags: [PracticeTests]
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
 *         description: Available practice tests fetched successfully
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
 *                         $ref: '#/components/schemas/PracticeAvailableTest'
 *       400:
 *         description: Invalid business ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/available',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  practiceTestController.available,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/publish:
 *   post:
 *     summary: Publish a practice test
 *     tags: [PracticeTests]
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
 *             $ref: '#/components/schemas/PublishPracticeTestRequest'
 *     responses:
 *       200:
 *         description: Practice test published successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PracticeTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/practice-tests/publish',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(PublishPracticeTestRequestDto),
  practiceTestController.publish,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/attempts:
 *   post:
 *     summary: Start a new attempt for a practice test
 *     tags: [PracticeTests]
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
 *             $ref: '#/components/schemas/StartPracticeAttemptRequest'
 *     responses:
 *       201:
 *         description: Practice attempt started successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StartPrecticeTestAttemptResponse'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/practice-tests/attempts',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(StartPracticeAttemptRequestDto),
  practiceTestController.startAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/attempts/{attemptId}:
 *   get:
 *     summary: Get details for a practice test attempt
 *     tags: [PracticeTests]
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
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Practice attempt fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PracticeTestAttemptDetails'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice attempt not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/attempts/:attemptId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  practiceTestController.getAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/attempts/{attemptId}/submit:
 *   post:
 *     summary: Submit answers for a practice test attempt
 *     tags: [PracticeTests]
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
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAttemptRequest'
 *     responses:
 *       200:
 *         description: Practice attempt submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubmitAttemptResponse'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice attempt not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/practice-tests/attempts/:attemptId/submit',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  validateDto(SubmitAttemptRequestDto),
  practiceTestController.submitAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/questions/{questionId}:
 *   put:
 *     summary: Update a question in a practice test
 *     tags: [PracticeTests]
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
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuestionDTO'
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:businessId/practice-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  validateDto(UpdateQuestionDto, true),
  practiceTestController.updateQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/questions/{questionId}:
 *   delete:
 *     summary: Delete a question from a practice test
 *     tags: [PracticeTests]
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
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:businessId/practice-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  practiceTestController.deleteQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests:
 *   post:
 *     summary: Create a new practice test
 *     tags: [PracticeTests]
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
 *             $ref: '#/components/schemas/CreatePracticeTestDTO'
 *     responses:
 *       201:
 *         description: Practice test created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PracticeTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/practice-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(CreatePracticeTestDto),
  practiceTestController.create,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests:
 *   get:
 *     summary: List practice tests for a business
 *     tags: [PracticeTests]
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
 *         name: status
 *         required: false
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: Filter by status (0=DRAFT, 1=PUBLISHED)
 *       - in: query
 *         name: batchId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by batch ID
 *     responses:
 *       200:
 *         description: Practice tests fetched successfully
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
 *                         $ref: '#/components/schemas/PracticeTest'
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  practiceTestController.list,
);

// Parameterized routes after all static ones
/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}/analytics/export:
 *   get:
 *     summary: Export practice test analytics as CSV
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     responses:
 *       200:
 *         description: Analytics exported as CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/:practiceTestId/analytics/export',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.exportAnalytics,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}/analytics:
 *   get:
 *     summary: Get practice test analytics
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     responses:
 *       200:
 *         description: Practice test analytics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestAnalytics'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/:practiceTestId/analytics',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.analytics,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}/questions:
 *   get:
 *     summary: List questions for a practice test
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     responses:
 *       200:
 *         description: Questions fetched successfully
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
 *                         $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/:practiceTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.listQuestions,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}/questions:
 *   post:
 *     summary: Create a question in a practice test
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuestionDTO'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/practice-tests/:practiceTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  validateDto(CreateQuestionDto),
  practiceTestController.createQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}:
 *   get:
 *     summary: Get a practice test by ID
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     responses:
 *       200:
 *         description: Practice test fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PracticeTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.get,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}:
 *   put:
 *     summary: Update a practice test
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePracticeTestDTO'
 *     responses:
 *       200:
 *         description: Practice test updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PracticeTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  validateDto(UpdatePracticeTestDto, true),
  practiceTestController.update,
);

/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}:
 *   delete:
 *     summary: Delete a practice test
 *     tags: [PracticeTests]
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
 *         name: practiceTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice test ID
 *     responses:
 *       200:
 *         description: Practice test deleted successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Practice test not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:businessId/practice-tests/:practiceTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('practiceTestId'),
  practiceTestController.remove,
);

// ==================== LMS EXAM TEST ROUTES ====================

// Static routes MUST come before parameterized routes
/**
 * @swagger
 * /api/business/{businessId}/exam-tests/available:
 *   get:
 *     summary: Get available exam tests for the authenticated user
 *     tags: [ExamTests]
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
 *         description: Available exam tests fetched successfully
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
 *                         $ref: '#/components/schemas/ExamAvailableTest'
 *       400:
 *         description: Invalid business ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/available',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  examTestController.available,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/publish:
 *   post:
 *     summary: Publish an exam test
 *     tags: [ExamTests]
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
 *             $ref: '#/components/schemas/PublishExamTestRequest'
 *     responses:
 *       200:
 *         description: Exam test published successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ExamTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/exam-tests/publish',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(PublishExamTestRequestDto),
  examTestController.publish,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/attempts:
 *   post:
 *     summary: Start a new attempt for an exam test
 *     tags: [ExamTests]
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
 *             $ref: '#/components/schemas/StartExamAttemptRequest'
 *     responses:
 *       201:
 *         description: Exam attempt started successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StartExamTestAttemptResponse'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/exam-tests/attempts',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(StartExamAttemptRequestDto),
  examTestController.startAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/attempts/{attemptId}:
 *   get:
 *     summary: Get details for an exam test attempt
 *     tags: [ExamTests]
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
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     responses:
 *       200:
 *         description: Exam attempt fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ExamTestAttemptDetails'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam attempt not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/attempts/:attemptId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  examTestController.getAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/attempts/{attemptId}/submit:
 *   post:
 *     summary: Submit answers for an exam test attempt
 *     tags: [ExamTests]
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
 *         name: attemptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attempt ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAttemptRequest'
 *     responses:
 *       200:
 *         description: Exam attempt submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubmitAttemptResponse'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam attempt not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/exam-tests/attempts/:attemptId/submit',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  validateStringIdParam('attemptId'),
  validateDto(SubmitAttemptRequestDto),
  examTestController.submitAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/questions/{questionId}:
 *   put:
 *     summary: Update a question in an exam test
 *     tags: [ExamTests]
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
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuestionDTO'
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:businessId/exam-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  validateDto(UpdateQuestionDto, true),
  examTestController.updateQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/questions/{questionId}:
 *   delete:
 *     summary: Delete a question from an exam test
 *     tags: [ExamTests]
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
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:businessId/exam-tests/questions/:questionId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('questionId'),
  examTestController.deleteQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests:
 *   post:
 *     summary: Create a new exam test
 *     tags: [ExamTests]
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
 *             $ref: '#/components/schemas/CreateExamTestDTO'
 *     responses:
 *       201:
 *         description: Exam test created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ExamTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/exam-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(CreateExamTestDto),
  examTestController.create,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests:
 *   get:
 *     summary: List exam tests for a business
 *     tags: [ExamTests]
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
 *         name: status
 *         required: false
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: Filter by status (0=DRAFT, 1=PUBLISHED)
 *       - in: query
 *         name: batchId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by batch ID
 *     responses:
 *       200:
 *         description: Exam tests fetched successfully
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
 *                         $ref: '#/components/schemas/ExamTest'
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  examTestController.list,
);

// Parameterized routes after all static ones
/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}/analytics/export:
 *   get:
 *     summary: Export exam test analytics as CSV
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     responses:
 *       200:
 *         description: Analytics exported as CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/:examTestId/analytics/export',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.exportAnalytics,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}/analytics:
 *   get:
 *     summary: Get exam test analytics
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     responses:
 *       200:
 *         description: Exam test analytics fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestAnalytics'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/:examTestId/analytics',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.analytics,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}/questions:
 *   get:
 *     summary: List questions for an exam test
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     responses:
 *       200:
 *         description: Questions fetched successfully
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
 *                         $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/:examTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.listQuestions,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}/questions:
 *   post:
 *     summary: Create a question in an exam test
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuestionDTO'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/TestQuestion'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:businessId/exam-tests/:examTestId/questions',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  validateDto(CreateQuestionDto),
  examTestController.createQuestion,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}:
 *   get:
 *     summary: Get an exam test by ID
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     responses:
 *       200:
 *         description: Exam test fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ExamTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:businessId/exam-tests/:examTestId',
  authorize(),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.get,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}:
 *   put:
 *     summary: Update an exam test
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateExamTestDTO'
 *     responses:
 *       200:
 *         description: Exam test updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ExamTest'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:businessId/exam-tests/:examTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  validateDto(UpdateExamTestDto, true),
  examTestController.update,
);

/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}:
 *   delete:
 *     summary: Delete an exam test
 *     tags: [ExamTests]
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
 *         name: examTestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam test ID
 *     responses:
 *       200:
 *         description: Exam test deleted successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Exam test not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:businessId/exam-tests/:examTestId',
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('examTestId'),
  examTestController.remove,
);

export default router;
