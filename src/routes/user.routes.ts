import { Router } from 'express';
import { getUsersByBusiness, createUserForBusiness, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { validateIdParam, authorizeUserAccess, authorizeBusinessAccess } from '../middlewares/validation.middleware';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * /api/business/{businessId}/users:
 *   post:
 *     summary: Create user for a business (Admin only)
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - No access to this business
 *       404:
 *         description: Business not found
 *       409:
 *         description: User with email/mobile already exists
 */
router.post('/business/:businessId/users', authenticate, authorize(UserRole.ADMIN), validateIdParam('businessId'), authorizeBusinessAccess, validateDto(CreateUserDto), createUserForBusiness);

/**
 * @swagger
 * /api/business/{businessId}/users:
 *   get:
 *     summary: Get all users for a specific business
 *     tags: [Users]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, TEACHER, STUDENT, USER]
 *         description: Filter users by role
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden - No access to this business
 *       404:
 *         description: Business not found
 */
router.get('/business/:businessId/users', authenticate, validateIdParam('businessId'), authorizeBusinessAccess, getUsersByBusiness);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - No access to this user
 *       404:
 *         description: User not found
 */
router.put('/users/:userId', authenticate, authorize(UserRole.ADMIN), validateIdParam('userId'), authorizeUserAccess, validateDto(UpdateUserDto), updateUser);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Soft delete user
 *     tags: [Users]
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
 *         description: User deleted successfully
 *       403:
 *         description: Forbidden - No access to this user
 *       404:
 *         description: User not found
 */
router.delete('/users/:userId', authenticate, authorize(UserRole.ADMIN), validateIdParam('userId'), authorizeUserAccess, deleteUser);

export default router;