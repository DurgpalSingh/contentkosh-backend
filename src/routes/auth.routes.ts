// src/routes/auth.routes.ts
import { Router } from 'express';
import { register, login, logout, getProfile, refreshToken, verifyEmail, resendVerification } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateDto } from '../middlewares/validation/dto.middleware';
import { RegisterRequest, LoginRequest, VerifyEmailRequest, ResendVerificationRequest } from '../dtos/auth.dto';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user (email verification required)
 *     description: >
 *       Two flows behind one endpoint, selected by whether `slug` is provided:
 *       omit `slug` to register a new institute owner (role ADMIN) and send the institute
 *       details in `business` - the business is only created once the emailed link is
 *       opened; pass `slug` to self-signup as a guest (role USER) joining that existing
 *       business. Neither flow logs the user in: a verification link is emailed and login
 *       is blocked until it is opened. The response carries `emailSent: false` when the
 *       mail could not be sent, so the client can offer a resend.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                         emailSent:
 *                           type: boolean
 *                         user:
 *                           type: object
 *       404:
 *         description: Business not found for the given slug (guest signup only)
 *       409:
 *         description: Email or mobile already exists
 */
router.post('/signup', validateDto(RegisterRequest), register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify an email address using the emailed magic link token
 *     description: >
 *       For a new institute owner the first use creates the business and logs the user in
 *       (auth cookies are set, `autoLogin: true`). For guests it only verifies. A link that
 *       was already used returns `alreadyVerified: true` without logging in. Links expire
 *       after 2 minutes.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified (or already verified)
 *       400:
 *         description: Invalid link (apiCode ERR_VERIFICATION_LINK_INVALID)
 *       409:
 *         description: The institute slug was taken before the link was opened
 *       410:
 *         description: Link expired (apiCode ERR_VERIFICATION_LINK_EXPIRED, body includes email)
 */
router.post('/verify-email', validateDto(VerifyEmailRequest), verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Request a new verification link
 *     description: >
 *       Always answers 200 with the same message, whether or not an unverified account exists
 *       for the email. A new link is only sent when one exists and the last mail was sent more
 *       than 60 seconds ago; sending a new link invalidates the previous one.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generic acknowledgement
 */
router.post('/resend-verification', validateDto(ResendVerificationRequest), resendVerification);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
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
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         user:
 *                           type: object
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: User account is inactive, or email not verified (apiCode ERR_EMAIL_NOT_VERIFIED)
 */
router.post('/login', validateDto(LoginRequest), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token received during login
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
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
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         user:
 *                           type: object
 *       401:
 *         description: Invalid, expired, or revoked refresh token
 *       403:
 *         description: User account is inactive
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (revokes refresh token)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token to revoke
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get logged-in user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, getProfile);

export default router;
