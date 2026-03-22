import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../../src/routes/auth.routes';
import { AuthService } from '../../../src/services/auth.service';
import * as UserService from '../../../src/services/user.service';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { AuthError, ForbiddenError, AlreadyExistsError } from '../../../src/errors/api.errors';

// Mock dependencies
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/services/user.service');
jest.mock('../../../src/utils/logger');

/**
 * Auth middleware mock:
 * The real authenticate reads from req.cookies['ck_access_token'].
 * We mock it to inject req.user based on a cookie value for /me tests.
 */
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        const token = req.cookies?.['ck_access_token'];
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        if (token === 'valid-token') {
            req.user = { id: 1, email: 'test@test.com', role: 'USER', businessId: 1 };
            next();
        } else {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
    },
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use(errorHandler);

describe('Auth Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== SIGNUP ====================

    describe('POST /auth/signup', () => {
        const validSignupData = {
            name: 'Test User',
            email: 'test@test.com',
            password: 'password123',
            mobile: '9876543210'
        };

        it('should register a new user successfully and set auth cookies', async () => {
            (AuthService.register as jest.Mock).mockResolvedValue({
                accessToken: 'jwt-access-token',
                refreshToken: 'jwt-refresh-token',
                user: {
                    id: 1,
                    email: 'test@test.com',
                    name: 'Test User',
                    role: 'USER',
                    businessId: null
                }
            });

            const res = await request(app)
                .post('/auth/signup')
                .send(validSignupData);

            expect(res.status).toBe(201);
            // Tokens are in httpOnly cookies, not in response body
            expect(res.body.data).toHaveProperty('email', 'test@test.com');
            expect(res.body.data).not.toHaveProperty('accessToken');
            expect(res.body.message).toContain('User registered successfully');
            // Cookies should be set
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should return 400 if name is missing', async () => {
            const res = await request(app)
                .post('/auth/signup')
                .send({ ...validSignupData, name: '' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if email is invalid', async () => {
            const res = await request(app)
                .post('/auth/signup')
                .send({ ...validSignupData, email: 'invalid-email' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/auth/signup')
                .send({ ...validSignupData, password: '12345' });

            expect(res.status).toBe(400);
        });

        it('should return 409 if email already exists', async () => {
            (AuthService.register as jest.Mock).mockRejectedValue(new AlreadyExistsError('User with this email already exists'));

            const res = await request(app)
                .post('/auth/signup')
                .send(validSignupData);

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('User with this email already exists');
        });

        it('should return 409 if mobile already exists', async () => {
            (AuthService.register as jest.Mock).mockRejectedValue(new AlreadyExistsError('User with this mobile already exists'));

            const res = await request(app)
                .post('/auth/signup')
                .send(validSignupData);

            expect(res.status).toBe(409);
            expect(res.body.message).toContain('User with this mobile already exists');
        });
    });

    // ==================== LOGIN ====================

    describe('POST /auth/login', () => {
        const validLoginData = {
            email: 'test@test.com',
            password: 'password123'
        };

        it('should login successfully and set auth cookies', async () => {
            (AuthService.login as jest.Mock).mockResolvedValue({
                accessToken: 'jwt-access-token',
                refreshToken: 'jwt-refresh-token',
                user: {
                    id: 1,
                    email: 'test@test.com',
                    name: 'Test User',
                    role: 'USER',
                    businessId: null
                }
            });

            const res = await request(app)
                .post('/auth/login')
                .send(validLoginData);

            expect(res.status).toBe(200);
            // Tokens are in httpOnly cookies, not in response body
            expect(res.body.data).toHaveProperty('email', 'test@test.com');
            expect(res.body.data).not.toHaveProperty('accessToken');
            expect(res.body.message).toContain('Login successful');
            // Cookies should be set
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ password: 'password123' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if password is missing', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ email: 'test@test.com' });

            expect(res.status).toBe(400);
        });

        it('should return 401 if credentials are invalid', async () => {
            (AuthService.login as jest.Mock).mockRejectedValue(new AuthError('Invalid email or password'));

            const res = await request(app)
                .post('/auth/login')
                .send(validLoginData);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Invalid email or password');
        });

        it('should return 403 if user is inactive', async () => {
            (AuthService.login as jest.Mock).mockRejectedValue(new ForbiddenError('User account is inactive'));

            const res = await request(app)
                .post('/auth/login')
                .send(validLoginData);

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('User account is inactive');
        });
    });

    // ==================== REFRESH TOKEN ====================

    describe('POST /auth/refresh', () => {
        it('should refresh tokens successfully using cookie', async () => {
            (AuthService.refreshTokens as jest.Mock).mockResolvedValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                user: {
                    id: 1,
                    email: 'test@test.com',
                    name: 'Test User',
                    role: 'USER',
                    businessId: null
                }
            });

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', 'ck_refresh_token=valid-refresh-token');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Tokens refreshed successfully');
            // New tokens set as cookies
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should return 401 if refresh cookie is missing', async () => {
            const res = await request(app)
                .post('/auth/refresh');

            // Controller returns 401 when no refresh token cookie
            expect(res.status).toBe(401);
        });

        it('should return 401 if refreshToken is invalid', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Invalid refresh token'));

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', 'ck_refresh_token=invalid-token');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Invalid refresh token');
        });

        it('should return 401 if refreshToken is revoked', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Refresh token has been revoked'));

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', 'ck_refresh_token=revoked-token');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Refresh token has been revoked');
        });

        it('should return 401 if refreshToken is expired', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Refresh token has expired'));

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', 'ck_refresh_token=expired-token');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Refresh token has expired');
        });
    });

    // ==================== LOGOUT ====================

    describe('POST /auth/logout', () => {
        it('should logout successfully and clear cookies', async () => {
            const res = await request(app)
                .post('/auth/logout');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Logout successful');
        });
    });

    // ==================== GET PROFILE ====================

    describe('GET /auth/me', () => {
        it('should return user profile when authenticated via cookie', async () => {
            (UserService.findUserById as jest.Mock).mockResolvedValue({
                id: 1,
                email: 'test@test.com',
                name: 'Test User',
                role: 'USER',
                businessId: 1
            });

            const res = await request(app)
                .get('/auth/me')
                .set('Cookie', 'ck_access_token=valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data).toHaveProperty('email', 'test@test.com');
            expect(res.body.message).toContain('Profile fetched successfully');
        });

        it('should return 401 if no token cookie provided', async () => {
            const res = await request(app)
                .get('/auth/me');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('No token provided');
        });

        it('should return 401 if token cookie is invalid', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Cookie', 'ck_access_token=invalid-token');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Invalid token');
        });
    });
});
