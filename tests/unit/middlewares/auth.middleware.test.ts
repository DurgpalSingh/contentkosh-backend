import { Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../../src/middlewares/auth.middleware';
import { AuthService } from '../../../src/services/auth.service';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';
import { UserRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/services/auth.service', () => ({
    AuthService: {
        verifyAccessToken: jest.fn()
    }
}));
jest.mock('../../../src/utils/logger');

describe('Auth Middleware', () => {
    let req: any;
    let res: any;
    let next: NextFunction;

    beforeEach(() => {
        req = {
            headers: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('authenticate', () => {
        it('should return unauthorized if no auth header', async () => {
            req.headers = {};
            await authenticate(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'No token provided' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should return unauthorized if header does not start with Bearer', async () => {
            req.headers = { authorization: 'Basic token' };
            await authenticate(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'No token provided' }));
        });

        it('should return unauthorized if token is missing', async () => {
            req.headers = { authorization: 'Bearer ' };
            await authenticate(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'No token provided' }));
        });

        it('should return unauthorized if token verify returns null', async () => {
            req.headers = { authorization: 'Bearer invalidtoken' };
            // eslint-disable-next-line
            (AuthService.verifyAccessToken as jest.Mock).mockReturnValue(null);

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Invalid or expired token' }));
            expect(next).not.toHaveBeenCalled();
        });

        it('should call next and set user context if token is valid', async () => {
            req.headers = { authorization: 'Bearer validtoken' };
            const mockUser = { id: 1, email: 'test@test.com', role: 'USER', businessId: 1 };
            // eslint-disable-next-line
            (AuthService.verifyAccessToken as jest.Mock).mockReturnValue(mockUser);

            await authenticate(req, res, next);

            expect(req.user).toEqual(mockUser);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('authorize', () => {
        it('should return unauthorized if req.user is missing', () => {
            const middleware = authorize(UserRole.ADMIN);
            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Unauthorized' }));
        });

        it('should return forbidden if user role is not allowed', () => {
            req.user = { role: UserRole.STUDENT };
            const middleware = authorize(UserRole.ADMIN, UserRole.TEACHER);
            middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Forbidden' }));
        });

        it('should call next if user role is allowed', () => {
            req.user = { role: UserRole.ADMIN };
            const middleware = authorize(UserRole.ADMIN);
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
});
