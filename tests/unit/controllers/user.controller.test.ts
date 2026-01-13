import { Request, Response } from 'express';
import * as UserController from '../../../src/controllers/user.controller';
import * as UserRepo from '../../../src/repositories/user.repo';
import * as BusinessRepo from '../../../src/repositories/business.repo';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import logger from '../../../src/utils/logger';
import { BadRequestError, NotFoundError, AlreadyExistsError } from '../../../src/errors/api.errors';

// Mock dependencies
jest.mock('../../../src/repositories/user.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/utils/apiResponse');
jest.mock('../../../src/utils/logger');

describe('User Controller', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        req = {
            params: {},
            body: {},
            query: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    // ==================== CREATE USER FOR BUSINESS ====================

    describe('createUserForBusiness', () => {
        const validUserData = {
            name: 'Amit Sharma',
            email: 'amit@contentkosh.com',
            mobile: '9876543210',
            role: 'TEACHER',
            password: 'Temp@123'
        };

        it('should create a user successfully', async () => {
            req.params = { businessId: '1' };
            req.body = validUserData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockResolvedValue({
                id: 1,
                ...validUserData,
                businessId: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await UserController.createUserForBusiness(req as Request, res as Response);

            expect(UserRepo.createUser).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Amit Sharma',
                email: 'amit@contentkosh.com',
                businessId: 1
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(
                res,
                expect.objectContaining({ id: 1 }),
                'User created successfully',
                201
            );
        });

        it('should throw BadRequestError if businessId is invalid', async () => {
            req.params = { businessId: 'invalid' };
            req.body = validUserData;

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw BadRequestError if businessId is zero', async () => {
            req.params = { businessId: '0' };
            req.body = validUserData;

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw NotFoundError if business does not exist', async () => {
            req.params = { businessId: '999' };
            req.body = validUserData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow(NotFoundError);
        });

        it('should throw AlreadyExistsError if email already exists', async () => {
            req.params = { businessId: '1' };
            req.body = validUserData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockRejectedValue(new Error('EMAIL_ALREADY_EXISTS'));

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow(AlreadyExistsError);
        });

        it('should throw AlreadyExistsError if mobile already exists', async () => {
            req.params = { businessId: '1' };
            req.body = validUserData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockRejectedValue(new Error('MOBILE_ALREADY_EXISTS'));

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow(AlreadyExistsError);
        });

        it('should rethrow unknown errors', async () => {
            req.params = { businessId: '1' };
            req.body = validUserData;

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.createUser as jest.Mock).mockRejectedValue(new Error('UNKNOWN_ERROR'));

            await expect(UserController.createUserForBusiness(req as Request, res as Response))
                .rejects.toThrow('UNKNOWN_ERROR');
        });
    });

    // ==================== GET USERS BY BUSINESS ====================

    describe('getUsersByBusiness', () => {
        it('should get users for a business successfully', async () => {
            req.params = { businessId: '1' };
            req.query = {};

            const mockUsers = [
                { id: 1, name: 'User 1', email: 'user1@test.com', role: 'TEACHER' },
                { id: 2, name: 'User 2', email: 'user2@test.com', role: 'STUDENT' }
            ];

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.findByBusinessId as jest.Mock).mockResolvedValue(mockUsers);

            await UserController.getUsersByBusiness(req as Request, res as Response);

            expect(UserRepo.findByBusinessId).toHaveBeenCalledWith(1, undefined);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(
                res,
                mockUsers,
                'Business users fetched successfully'
            );
        });

        it('should filter users by role', async () => {
            req.params = { businessId: '1' };
            req.query = { role: 'TEACHER' };

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue({ id: 1 });
            (UserRepo.findByBusinessId as jest.Mock).mockResolvedValue([]);

            await UserController.getUsersByBusiness(req as Request, res as Response);

            expect(UserRepo.findByBusinessId).toHaveBeenCalledWith(1, 'TEACHER');
        });

        it('should throw BadRequestError if businessId is invalid', async () => {
            req.params = { businessId: 'invalid' };

            await expect(UserController.getUsersByBusiness(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw NotFoundError if business does not exist', async () => {
            req.params = { businessId: '999' };

            (BusinessRepo.findBusinessById as jest.Mock).mockResolvedValue(null);

            await expect(UserController.getUsersByBusiness(req as Request, res as Response))
                .rejects.toThrow(NotFoundError);
        });
    });

    // ==================== UPDATE USER ====================

    describe('updateUser', () => {
        it('should update a user successfully', async () => {
            req.params = { userId: '1' };
            req.body = { name: 'Updated Name' };

            const updatedUser = {
                id: 1,
                name: 'Updated Name',
                email: 'test@test.com',
                role: 'TEACHER',
                status: 'ACTIVE'
            };

            (UserRepo.exists as jest.Mock).mockResolvedValue(true);
            (UserRepo.updateUser as jest.Mock).mockResolvedValue(updatedUser);

            await UserController.updateUser(req as Request, res as Response);

            expect(UserRepo.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({
                name: 'Updated Name'
            }));
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(
                res,
                updatedUser,
                'User updated successfully'
            );
        });

        it('should throw BadRequestError if userId is invalid', async () => {
            req.params = { userId: 'invalid' };
            req.body = { name: 'Test' };

            await expect(UserController.updateUser(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw NotFoundError if user does not exist', async () => {
            req.params = { userId: '999' };
            req.body = { name: 'Test' };

            (UserRepo.exists as jest.Mock).mockResolvedValue(false);

            await expect(UserController.updateUser(req as Request, res as Response))
                .rejects.toThrow(NotFoundError);
        });
    });

    // ==================== DELETE USER ====================

    describe('deleteUser', () => {
        it('should soft delete a user successfully', async () => {
            req.params = { userId: '1' };

            (UserRepo.exists as jest.Mock).mockResolvedValue(true);
            (UserRepo.softDeleteUser as jest.Mock).mockResolvedValue({ id: 1, status: 'INACTIVE' });

            await UserController.deleteUser(req as Request, res as Response);

            expect(UserRepo.softDeleteUser).toHaveBeenCalledWith(1);
            expect(ApiResponseHandler.success).toHaveBeenCalledWith(
                res,
                null,
                'User deleted successfully'
            );
        });

        it('should throw BadRequestError if userId is invalid', async () => {
            req.params = { userId: 'invalid' };

            await expect(UserController.deleteUser(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw BadRequestError if userId is zero', async () => {
            req.params = { userId: '0' };

            await expect(UserController.deleteUser(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw BadRequestError if userId is negative', async () => {
            req.params = { userId: '-1' };

            await expect(UserController.deleteUser(req as Request, res as Response))
                .rejects.toThrow(BadRequestError);
        });

        it('should throw NotFoundError if user does not exist', async () => {
            req.params = { userId: '999' };

            (UserRepo.exists as jest.Mock).mockResolvedValue(false);

            await expect(UserController.deleteUser(req as Request, res as Response))
                .rejects.toThrow(NotFoundError);
        });
    });
});
