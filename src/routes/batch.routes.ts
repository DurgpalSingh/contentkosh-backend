import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateIdParam, authorizeBatchAccess, authorizeCourseAccess } from '../middlewares/validation.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { CreateBatchDto, UpdateBatchDto, AddUserToBatchDto, RemoveUserFromBatchDto, UpdateBatchUserDto } from '../dtos/batch.dto';
import {
    batchController
} from '../controllers/batch.controller';

const router = Router();

// ==================== BATCH CRUD ROUTES ====================

/**
 * @swagger
 * /api/batches/all:
 *   get:
 *     summary: Get all active batches (role-aware)
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active batches fetched successfully
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/all', batchController.getAllActiveBatches);

/**
 * @swagger
 * /api/batches:
 *   post:
 *     summary: Create a new batch
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBatchRequest'
 *     responses:
 *       201:
 *         description: Batch created successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Course not found
 *       409:
 *         description: Batch with this code name already exists
 *       500:
 *         description: Internal server error
 */
router.post('/', authorize(UserRole.ADMIN), validateDto(CreateBatchDto), batchController.createBatch);

/**
 * @swagger
 * /api/batches/{id}:
 *   get:
 *     summary: Get batch by ID
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *     responses:
 *       200:
 *         description: Batch fetched successfully
 *       400:
 *         description: Invalid batch ID
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', validateIdParam('id'), authorizeBatchAccess, batchController.getBatch);


/**
 * @swagger
 * /api/batches/course/{courseId}:
 *   get:
 *     summary: Get all batches for a course
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true for active only, false for all)
 *     responses:
 *       200:
 *         description: Batches fetched successfully
 *       400:
 *         description: Invalid course ID
 *       500:
 *         description: Internal server error
 */
router.get('/course/:courseId', validateIdParam('courseId'), authorizeCourseAccess, batchController.getBatchesByCourse);

/**
 * @swagger
 * /api/batches/{id}:
 *   put:
 *     summary: Update batch
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBatchRequest'
 *     responses:
 *       200:
 *         description: Batch updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Batch not found
 *       409:
 *         description: Batch with this code name already exists
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authorize(UserRole.ADMIN), validateIdParam('id'), validateDto(UpdateBatchDto), authorizeBatchAccess, batchController.updateBatch);

/**
 * @swagger
 * /api/batches/{id}:
 *   delete:
 *     summary: Delete batch
 *     tags: [Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *     responses:
 *       200:
 *         description: Batch deleted successfully
 *       400:
 *         description: Invalid batch ID
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateIdParam('id'), authorizeBatchAccess, batchController.deleteBatch);

// ==================== BATCH USER ROUTES ====================

/**
 * @swagger
 * /api/batches/add-user:
 *   post:
 *     summary: Add user to batch
 *     tags: [Batch Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddUserToBatchRequest'
 *     responses:
 *       201:
 *         description: User added to batch successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User or batch not found
 *       409:
 *         description: User is already in this batch
 *       500:
 *         description: Internal server error
 */
router.post('/add-user', authorize(UserRole.ADMIN), validateDto(AddUserToBatchDto), batchController.addUserToBatch);

/**
 * @swagger
 * /api/batches/remove-user:
 *   post:
 *     summary: Remove user from batch
 *     tags: [Batch Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemoveUserFromBatchRequest'
 *     responses:
 *       200:
 *         description: User removed from batch successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User is not in this batch
 *       500:
 *         description: Internal server error
 */
router.post('/remove-user', authorize(UserRole.ADMIN), validateDto(RemoveUserFromBatchDto), batchController.removeUserFromBatch);

/**
 * @swagger
 * /api/batches/user/{userId}:
 *   get:
 *     summary: Get all batches for a user
 *     tags: [Batch Users]
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
 *         description: User batches fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BatchUser'
 *       400:
 *         description: Invalid user ID
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', validateIdParam('userId'), batchController.getBatchesByUser);

/**
 * @swagger
 * /api/batches/{batchId}/users:
 *   get:
 *     summary: Get all users for a batch
 *     tags: [Batch Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [STUDENT, TEACHER, ADMIN, USER]
 *         description: Filter users by role
 *     responses:
 *       200:
 *         description: Batch users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BatchUser'
 *       400:
 *         description: Invalid batch ID
 *       500:
 *         description: Internal server error
 */
router.get('/:batchId/users', validateIdParam('batchId'), authorizeBatchAccess, batchController.getUsersByBatch);

/**
 * @swagger
 * /api/batches/{batchId}/users/{userId}:
 *   put:
 *     summary: Update batch user status
 *     tags: [Batch Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Batch ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBatchUserRequest'
 *     responses:
 *       200:
 *         description: Batch user updated successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: User is not in this batch
 *       500:
 *         description: Internal server error
 */
router.put('/:batchId/users/:userId', authorize(UserRole.ADMIN), validateIdParam('batchId'), validateIdParam('userId'), validateDto(UpdateBatchUserDto), authorizeBatchAccess, batchController.updateBatchUser);

export default router;
