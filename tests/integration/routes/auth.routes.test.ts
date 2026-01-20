import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../../src/routes/auth.routes';
import { AuthService } from '../../../src/services/auth.service';
import * as UserRepo from '../../../src/repositories/user.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { AuthError, ForbiddenError, AlreadyExistsError } from '../../../src/errors/api.errors';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/utils/logger');

// Mock authenticate middleware for /me route
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        // Check for Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
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

        it('should register a new user successfully', async () => {
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
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('refreshToken');
            expect(res.body.data.user.email).toBe('test@test.com');
            expect(res.body.message).toContain('User registered successfully');
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

        it('should login successfully', async () => {
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
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('refreshToken');
            expect(res.body.data.user.email).toBe('test@test.com');
            expect(res.body.message).toContain('Login successful');
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
        const validRefreshData = {
            refreshToken: 'valid-refresh-token'
        };

        it('should refresh tokens successfully', async () => {
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
                .send(validRefreshData);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('refreshToken');
            expect(res.body.message).toContain('Tokens refreshed successfully');
        });

        it('should return 400 if refreshToken is missing', async () => {
            const res = await request(app)
                .post('/auth/refresh')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 401 if refreshToken is invalid', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Invalid refresh token'));

            const res = await request(app)
                .post('/auth/refresh')
                .send(validRefreshData);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Invalid refresh token');
        });

        it('should return 401 if refreshToken is revoked', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Refresh token has been revoked'));

            const res = await request(app)
                .post('/auth/refresh')
                .send(validRefreshData);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Refresh token has been revoked');
        });

        it('should return 401 if refreshToken is expired', async () => {
            (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AuthError('Refresh token has expired'));

            const res = await request(app)
                .post('/auth/refresh')
                .send(validRefreshData);

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Refresh token has expired');
        });
    });

    // ==================== LOGOUT ====================

    describe('POST /auth/logout', () => {
        it('should logout successfully', async () => {
            const res = await request(app)
                .post('/auth/logout');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Logout successful');
        });
    });

    // ==================== GET PROFILE ====================

    describe('GET /auth/me', () => {
        it('should return user profile when authenticated', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data).toHaveProperty('email', 'test@test.com');
            expect(res.body.message).toContain('Profile fetched successfully');
        });

        it('should return 401 if no token provided', async () => {
            const res = await request(app)
                .get('/auth/me');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('No token provided');
        });

        it('should return 401 if token is invalid', async () => {
            const res = await request(app)
                .get('/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(401);
            expect(res.body.message).toContain('Invalid token');
        });
    });
});
