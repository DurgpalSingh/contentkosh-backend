
import 'reflect-metadata';
import request from 'supertest';
import express from 'express';

// Define mock functions outside
const mockGetUserPermissions = jest.fn();
const mockAssignPermissions = jest.fn();
const mockUpdatePermissions = jest.fn();
const mockDeletePermissions = jest.fn();
const mockDeleteSpecificPermissions = jest.fn();

// Mock PermissionService BEFORE importing routes
jest.mock('../../../src/services/permission.service', () => {
    return {
        PermissionService: jest.fn().mockImplementation(() => {
            return {
                getUserPermissions: mockGetUserPermissions,
                assignPermissions: mockAssignPermissions,
                updatePermissions: mockUpdatePermissions,
                deletePermissions: mockDeletePermissions,
                deleteSpecificPermissions: mockDeleteSpecificPermissions,
            };
        }),
    };
});

jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 1, role: 'ADMIN' };
        next();
    },
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
}));

// Import routes AFTER mocking
import permissionRoutes from '../../../src/routes/permission.routes';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { authenticate } from '../../../src/middlewares/auth.middleware';

const app = express();
app.use(express.json());
app.use(authenticate);
app.use('/api/permission', permissionRoutes);
app.use(errorHandler);

describe('Permission Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================== GET PERMISSIONS ====================
    describe('GET /api/permission', () => {
        it('should return user permissions when user_id is provided', async () => {
            const mockResult = {
                user: { id: 1, role: 'ADMIN' },
                permissions: ['CONTENT_CREATE', 'CONTENT_VIEW']
            };
            mockGetUserPermissions.mockResolvedValue(mockResult);

            const res = await request(app).get('/api/permission?user_id=1');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockResult);
            expect(mockGetUserPermissions).toHaveBeenCalledWith(1);
        });

        it('should return permissions for logged in user if user_id missing', async () => {
            const mockResult = {
                user: { id: 1, role: 'ADMIN' },
                permissions: ['CONTENT_CREATE']
            };
            mockGetUserPermissions.mockResolvedValue(mockResult);

            const res = await request(app).get('/api/permission');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockResult);
            expect(mockGetUserPermissions).toHaveBeenCalledWith(1);
        });

        it('should return 500 if service throws error', async () => {
            mockGetUserPermissions.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/permission?user_id=1');

            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Database error');
        });
    });

    // ==================== POST / Assign Permissions ====================
    describe('POST /api/permission', () => {
        const validPayload = {
            userId: 2,
            permissions: ['CONTENT_CREATE', 'CONTENT_EDIT']
        };

        it('should assign permissions successfully', async () => {
            const mockResult = {
                user: { id: 2, role: 'USER' },
                permissions: ['CONTENT_CREATE', 'CONTENT_EDIT']
            };
            mockAssignPermissions.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/api/permission')
                .send(validPayload);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockResult);
            expect(mockAssignPermissions).toHaveBeenCalled();
        });

        it('should return 400 for invalid payload', async () => {
            const res = await request(app)
                .post('/api/permission')
                .send({ userId: 'string', permissions: 'not-array' }); // Invalid types

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('errors');
        });
    });

    // ==================== PUT / Update Permissions ====================
    describe('PUT /api/permission', () => {
        const validPayload = {
            userId: 2,
            permissions: ['CONTENT_VIEW']
        };

        it('should update permissions successfully', async () => {
            const mockResult = {
                user: { id: 2, role: 'USER' },
                permissions: ['CONTENT_VIEW']
            };
            mockUpdatePermissions.mockResolvedValue(mockResult);

            const res = await request(app)
                .put('/api/permission')
                .send(validPayload);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockResult);
            expect(mockUpdatePermissions).toHaveBeenCalled();
        });
    });

    // ==================== DELETE / Permissions ====================
    describe('DELETE /api/permission', () => {
        it('should delete specific permissions when permissions array is provided', async () => {
            const mockResult = {
                user: { id: 2, role: 'USER' },
                permissions: [] // assume empty after delete
            };
            mockDeleteSpecificPermissions.mockResolvedValue(mockResult);

            const res = await request(app)
                .delete('/api/permission')
                .send({ userId: 2, permissions: ['CONTENT_CREATE'] });

            expect(res.status).toBe(200);
            // Note: controller calls deleteSpecificPermissions if perm array > 0
            expect(mockDeleteSpecificPermissions).toHaveBeenCalled();
        });

        it('should delete all permissions when permissions array is not provided', async () => {
            mockDeletePermissions.mockResolvedValue({ count: 5 });

            const res = await request(app)
                .delete('/api/permission')
                .send({ userId: 2 });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('All permissions removed');
            expect(mockDeletePermissions).toHaveBeenCalledWith(2);
        });
    });
});
