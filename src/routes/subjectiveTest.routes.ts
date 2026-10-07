import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { authorizeBusinessAccess, validateIdParam, validateStringIdParam } from '../middlewares/validation.middleware';
import { createPrivatePdfUpload } from '../middlewares/upload.middleware';
import {
  requireDraftTestBeforeUpload,
  requireGradableSubmissionBeforeUpload,
  requireOpenAttemptBeforeUpload,
} from '../middlewares/subjectiveTestAccess.middleware';
import { SUBJECTIVE_TEST_CONFIG } from '../config/subjectiveTest.config';
import {
  CreateSubjectiveTestDto,
  GradeSubjectiveSubmissionDto,
  PublishSubjectiveTestRequestDto,
  UpdateSubjectiveTestDto,
} from '../dtos/subjectiveTest.dto';
import { subjectiveTestController } from '../controllers/subjectiveTest.controller';

export const subjectiveTestRouter = Router();

const STAFF_ROLES = [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPERADMIN] as const;
const { uploadFieldNames } = SUBJECTIVE_TEST_CONFIG;

// ==================== SUBJECTIVE TEST ROUTES ====================
// Files are PDFs only (max 20MB) and are streamed through these routes; they are never public URLs.
// Upload routes check access BEFORE the upload middleware, so a refused request never writes a file.

// Static routes MUST come before parameterized routes
/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/available:
 *   get:
 *     summary: List subjective tests available to the authenticated student
 *     description: Published tests from every batch where the student has an active membership, with availability and the student's own status.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Available subjective tests fetched successfully
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
 *                         $ref: '#/components/schemas/SubjectiveAvailableTest'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/available',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  subjectiveTestController.listTestsForStudent,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/publish:
 *   post:
 *     summary: Publish a draft subjective test
 *     description: Requires an uploaded question paper, positive marks and duration, and a future deadline after the start time.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishSubjectiveTestRequest'
 *     responses:
 *       200:
 *         description: Subjective test published successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveTest'
 *       400:
 *         description: Test is not ready to publish
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.post(
  '/:businessId/subjective-tests/publish',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(PublishSubjectiveTestRequestDto),
  subjectiveTestController.publishDraftTest,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/submissions/{submissionId}:
 *   get:
 *     summary: Get the authenticated student's own submission
 *     description: Marks, remarks and the checked copy are included only once the submission is CHECKED.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveStudentSubmission'
 *       404:
 *         description: Submission not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/submissions/:submissionId',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('submissionId'),
  subjectiveTestController.getOwnAttemptDetail,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/submissions/{submissionId}/answer-sheet:
 *   get:
 *     summary: Download the authenticated student's submitted answer sheet
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Answer sheet not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/submissions/:submissionId/answer-sheet',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('submissionId'),
  subjectiveTestController.downloadOwnAnswerSheet,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/submissions/{submissionId}/checked-answer-sheet:
 *   get:
 *     summary: Download the latest checked copy of the authenticated student's answer sheet
 *     description: Available only once the submission is CHECKED.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Checked answer sheet not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/submissions/:submissionId/checked-answer-sheet',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('submissionId'),
  subjectiveTestController.downloadOwnCheckedCopy,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests:
 *   post:
 *     summary: Create a draft subjective test
 *     description: Upload the question paper afterwards with PUT /{subjectiveTestId}/question-paper; it is required to publish.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubjectiveTestRequest'
 *     responses:
 *       201:
 *         description: Subjective test created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveTest'
 *       400:
 *         description: Invalid input data
 */
subjectiveTestRouter.post(
  '/:businessId/subjective-tests',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(CreateSubjectiveTestDto),
  subjectiveTestController.createDraftTest,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests:
 *   get:
 *     summary: List subjective tests for staff
 *     description: Admins see every test in the business; teachers see the tests they created.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: paperType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subjective tests fetched successfully
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
 *                         $ref: '#/components/schemas/SubjectiveTest'
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  subjectiveTestController.listTestsForStaff,
);

// Parameterized routes after all static ones
/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}:
 *   get:
 *     summary: Get a subjective test with per-status submission counts
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subjective test fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveTestDetail'
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  subjectiveTestController.getTestDetailForStaff,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}:
 *   put:
 *     summary: Update a draft subjective test
 *     description: Send only the changed fields. Replace the question paper with PUT /{subjectiveTestId}/question-paper.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSubjectiveTestRequest'
 *     responses:
 *       200:
 *         description: Subjective test updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveTest'
 *       400:
 *         description: Invalid input, or the test is already published
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.put(
  '/:businessId/subjective-tests/:subjectiveTestId',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  validateDto(UpdateSubjectiveTestDto, true),
  subjectiveTestController.updateDraftTest,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/question-paper:
 *   put:
 *     summary: Upload or replace the question paper of a draft test
 *     description: Access is checked before the file is stored. The previous paper is deleted after the new one is saved.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [questionPaper]
 *             properties:
 *               questionPaper:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Question paper uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveTest'
 *       400:
 *         description: Missing/invalid PDF, or the test is already published
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.put(
  '/:businessId/subjective-tests/:subjectiveTestId/question-paper',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  requireDraftTestBeforeUpload,
  createPrivatePdfUpload({ fieldName: uploadFieldNames.questionPaper, missingFileMessage: 'Upload the question paper' }),
  subjectiveTestController.replaceQuestionPaper,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}:
 *   delete:
 *     summary: Delete a draft subjective test with no submissions
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subjective test deleted successfully
 *       400:
 *         description: Test is published or has submissions
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.delete(
  '/:businessId/subjective-tests/:subjectiveTestId',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  subjectiveTestController.deleteDraftTest,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/question-paper:
 *   get:
 *     summary: Download the question paper
 *     description: Staff need access to the test. Students must have started the test.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Student has not started the test
 *       404:
 *         description: Question paper not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId/question-paper',
  authorize(...STAFF_ROLES, UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  subjectiveTestController.downloadQuestionPaper,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/start:
 *   post:
 *     summary: Start or resume the student's single attempt
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attempt started or resumed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveStartResult'
 *       400:
 *         description: Test not open, time over, or already submitted
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.post(
  '/:businessId/subjective-tests/:subjectiveTestId/start',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  subjectiveTestController.startOrResumeAttempt,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions:
 *   post:
 *     summary: Upload the answer sheet and submit the student's attempt
 *     description: Accepted once, only for an in-progress attempt before its effective end time.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [answerSheet]
 *             properties:
 *               answerSheet:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Answer sheet submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveSubmitResult'
 *       400:
 *         description: Invalid file, time over, or already submitted
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.post(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions',
  authorize(UserRole.STUDENT),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  requireOpenAttemptBeforeUpload,
  createPrivatePdfUpload({ fieldName: uploadFieldNames.answerSheet, missingFileMessage: 'Upload your answer sheet' }),
  subjectiveTestController.submitAnswerSheet,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions:
 *   get:
 *     summary: List the batch roster with each student's submission status
 *     description: Includes active batch students who have not started (NOT_STARTED).
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/SubjectiveDisplayStatus'
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches student name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Submissions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveSubmissionList'
 *       404:
 *         description: Subjective test not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  subjectiveTestController.listRosterForStaff,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions/{submissionId}:
 *   get:
 *     summary: Get one submission with grading details
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveStaffSubmission'
 *       404:
 *         description: Submission not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions/:submissionId',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  validateStringIdParam('submissionId'),
  subjectiveTestController.getSubmissionDetailForStaff,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions/{submissionId}/answer-sheet:
 *   get:
 *     summary: Download a student's original answer sheet
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Answer sheet not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions/:submissionId/answer-sheet',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  validateStringIdParam('submissionId'),
  subjectiveTestController.downloadAnswerSheetForStaff,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions/{submissionId}/checked-answer-sheet:
 *   get:
 *     summary: Download the latest checked copy of a student's answer sheet
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Checked answer sheet not found
 */
subjectiveTestRouter.get(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions/:submissionId/checked-answer-sheet',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  validateStringIdParam('submissionId'),
  subjectiveTestController.downloadCheckedCopyForStaff,
);

/**
 * @swagger
 * /api/business/{businessId}/subjective-tests/{subjectiveTestId}/submissions/{submissionId}/grade:
 *   put:
 *     summary: Add or update marks, remarks and the checked answer sheet
 *     description: The checked PDF is required the first time; later updates may change marks/remarks only. Sending a new PDF replaces the previous checked copy.
 *     tags: [SubjectiveTests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: subjectiveTestId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON string matching GradeSubjectiveSubmissionRequest
 *               checkedAnswerSheet:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Submission graded successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SubjectiveStaffSubmission'
 *       400:
 *         description: Invalid marks/file, or the submission is not submitted yet
 *       404:
 *         description: Submission not found
 *       409:
 *         description: Updated by someone else at the same time
 */
subjectiveTestRouter.put(
  '/:businessId/subjective-tests/:subjectiveTestId/submissions/:submissionId/grade',
  authorize(...STAFF_ROLES),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateStringIdParam('subjectiveTestId'),
  validateStringIdParam('submissionId'),
  requireGradableSubmissionBeforeUpload,
  createPrivatePdfUpload({ fieldName: uploadFieldNames.checkedAnswerSheet }),
  validateDto(GradeSubjectiveSubmissionDto),
  subjectiveTestController.gradeSubmission,
);
