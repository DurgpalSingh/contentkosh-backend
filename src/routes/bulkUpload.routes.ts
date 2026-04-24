import { Router } from 'express';
import { authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { authorizeBusinessAccess, validateIdParam } from '../middlewares/validation.middleware';
import { BulkUploadConfirmDto } from '../dtos/bulkUpload.dto';
import { bulkUploadController } from '../controllers/bulkUpload.controller';
import { uploadBulkFile } from '../middlewares/upload.middleware';

export const bulkUploadRouter = Router();

/**
 * @swagger
 * /api/business/{businessId}/bulk-upload:
 *   post:
 *     summary: Upload a .doc/.docx file and preview parsed questions
 *     description: |
 *       Parses a Word document containing questions in the defined format.
 *       Returns a preview of valid questions and any questions with format errors.
 *       Does NOT persist any questions — use the confirm endpoint to save.
 *     tags: [BulkUpload]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - testId
 *               - testType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The .doc or .docx file containing questions
 *               testId:
 *                 type: string
 *                 description: The ID of the practice or exam test to add questions to
 *               testType:
 *                 type: string
 *                 enum: [practice, exam]
 *                 description: Whether this is a practice or exam test
 *     responses:
 *       200:
 *         description: File parsed successfully — returns preview of valid and invalid questions
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
 *                         validQuestions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               questionText:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                                 enum: [SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, NUMERICAL, FILL_IN_THE_BLANK]
 *                               options:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               answer:
 *                                 type: string
 *                               solution:
 *                                 type: string
 *                                 nullable: true
 *                         invalidQuestions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               position:
 *                                 type: integer
 *                               rawText:
 *                                 type: string
 *                               errors:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                         sessionToken:
 *                           type: string
 *                           description: Token used to confirm the upload (valid for 30 minutes)
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       422:
 *         description: Invalid file type, file too large, or no question blocks found
 *       500:
 *         description: Internal server error
 */
bulkUploadRouter.post(
  '/:businessId/bulk-upload',
  authorize(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPERADMIN),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  uploadBulkFile,
  bulkUploadController.uploadAndPreview,
);

/**
 * @swagger
 * /api/business/{businessId}/bulk-upload/confirm:
 *   post:
 *     summary: Confirm bulk upload and persist all valid questions
 *     description: |
 *       Uses the sessionToken from the parse step to save all valid questions to the database.
 *       The session token is valid for 30 minutes from the time of the initial upload.
 *     tags: [BulkUpload]
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
 *             type: object
 *             required:
 *               - sessionToken
 *               - testId
 *               - testType
 *             properties:
 *               sessionToken:
 *                 type: string
 *                 description: The session token returned by the parse endpoint
 *               testId:
 *                 type: string
 *                 description: The ID of the practice or exam test
 *               testType:
 *                 type: string
 *                 enum: [practice, exam]
 *                 description: Whether this is a practice or exam test
 *     responses:
 *       200:
 *         description: Questions saved successfully
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
 *                         savedCount:
 *                           type: integer
 *                           description: Number of questions successfully saved
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Test not found
 *       410:
 *         description: Upload session expired or not found
 *       500:
 *         description: Internal server error
 */
bulkUploadRouter.post(
  '/:businessId/bulk-upload/confirm',
  authorize(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPERADMIN),
  validateIdParam('businessId'),
  authorizeBusinessAccess,
  validateDto(BulkUploadConfirmDto),
  bulkUploadController.confirmUpload,
);
