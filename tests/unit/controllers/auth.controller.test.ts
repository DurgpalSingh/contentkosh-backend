import { Request, Response } from 'express';
import * as AuthController from '../../../src/controllers/auth.controller';
import * as UserRepo from '../../../src/repositories/user.repo';
import { AuthService } from '../../../src/services/auth.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { UserStatus, UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/services/auth.service');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('Auth Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    // ==================== SIGNUP TESTS ====================
    describe('signup', () => {
        const validSignupData = {
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User',
            mobile: '1234567890'
        };

        it('should signup a user successfully', async () => {
            req.body = validSignupData;
            const createdUser = { id: 1, ...validSignupData, role: UserRole.USER, status: UserStatus.ACTIVE };

            (UserRepo.createUser as jest.Mock).mockResolvedValue(createdUser);

            await AuthController.signup(req as Request, res as Response);

            expect(UserRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({
                email: validSignupData.email,
                role: UserRole.USER,
                status: UserStatus.ACTIVE
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(res, createdUser, 'Signup successful', 201);
        });

        it('should throw error if email/password/name missing', async () => {
            req.body = { email: 'test@example.com' }; // missing password/name
            await expect(AuthController.signup(req as Request, res as Response)).rejects.toThrow('Email, password, and name are required');
        });
    });

    // ==================== LOGIN TESTS ====================
    describe('login', () => {
        const loginData = { email: 'test@example.com', password: 'password123' };

        it('should login successfully', async () => {
            req.body = loginData;
            const user = { id: 1, email: loginData.email, password: 'hashedhash', role: UserRole.USER, status: UserStatus.ACTIVE };

            (UserRepo.findByEmailWithBusinesses as jest.Mock).mockResolvedValue(user);
            (AuthService.verifyPassword as jest.Mock).mockResolvedValue(true);
            (AuthService.generateToken as jest.Mock).mockReturnValue('mock_token');

            await AuthController.login(req as Request, res as Response);

            expect(ApiResponseHandler.success).toHaveBeenCalledWith(
                res,
                expect.objectContaining({ token: 'mock_token' }),
                'Login successful'
            );
        });

        it('should fail if user inactive', async () => {
            req.body = loginData;
            const user = { id: 1, email: loginData.email, password: 'hashedhash', role: UserRole.USER, status: UserStatus.INACTIVE };

            (UserRepo.findByEmailWithBusinesses as jest.Mock).mockResolvedValue(user);
            (AuthService.verifyPassword as jest.Mock).mockResolvedValue(true);

            await expect(AuthController.login(req as Request, res as Response)).rejects.toThrow('User account is inactive');
        });

        it('should fail if invalid credentials', async () => {
            req.body = loginData;
            (UserRepo.findByEmailWithBusinesses as jest.Mock).mockResolvedValue(null);
            await expect(AuthController.login(req as Request, res as Response)).rejects.toThrow('Invalid credentials');
        });
    });
});
