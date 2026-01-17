
import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import permissionRoutes from '../../../src/routes/permission.routes';
import { PermissionService } from '../../../src/services/permission.service';
import { ApiError, BadRequestError, NotFoundError } from '../../../src/errors/api.errors';

// Mock dependency
jest.mock('../../../src/services/permission.service');

const app = express();
app.use(express.json());
app.use('/permission', permissionRoutes);

describe('Permission Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockPermissions = ['CONTENT_CREATE', 'CONTENT_VIEW'];
    const mockUserPermissions = {
        user: { id: 1, role: 'USER' },
        permissions: mockPermissions
    };

    // ==================== GET PERMISSIONS ====================
    describe('GET /permission', () => {
        it('should return user permissions when user_id is provided', async () => {
            (PermissionService.prototype.getUserPermissions as jest.Mock).mockResolvedValue(mockUserPermissions);

            const res = await request(app).get('/permission').query({ user_id: 1 });

            expect(res.status).toBe(200);
            expect(res.body.data.permissions).toEqual(mockPermissions);
            expect(PermissionService.prototype.getUserPermissions).toHaveBeenCalledWith(1);
        });

        it('should return 400 if user_id is missing', async () => {
            const res = await request(app).get('/permission');
            expect(res.status).toBe(400);
            expect(res.body.message).toContain('User ID is required');
        });

        it('should return 404 if user not found', async () => {
            (PermissionService.prototype.getUserPermissions as jest.Mock).mockRejectedValue(new NotFoundError('User not found'));

            const res = await request(app).get('/permission').query({ user_id: 999 });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('User not found');
        });
    });

    // ==================== ASSIGN PERMISSIONS ====================
    describe('POST /permission', () => {
        const validPayload = {
            userId: 1,
            permissions: ['CONTENT_CREATE']
        };

        it('should assign permissions successfully', async () => {
            (PermissionService.prototype.assignPermissions as jest.Mock).mockResolvedValue(mockUserPermissions);

            const res = await request(app).post('/permission').send(validPayload);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockUserPermissions);
        });

        it('should return 400 if permissions list is empty', async () => {
            const res = await request(app).post('/permission').send({ userId: 1, permissions: [] });
            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Permissions are required');
        });

        it('should return 400 if user not found', async () => {
            (PermissionService.prototype.assignPermissions as jest.Mock).mockRejectedValue(new NotFoundError('User not found'));

            const res = await request(app).post('/permission').send(validPayload);
            expect(res.status).toBe(404);
        });
    });

    // ==================== UPDATE PERMISSIONS ====================
    describe('PUT /permission', () => {
        const validPayload = {
            userId: 1,
            permissions: ['CONTENT_EDIT']
        };

        it('should update permissions successfully', async () => {
            const updatedPermissions = {
                user: { id: 1, role: 'USER' },
                permissions: ['CONTENT_EDIT']
            };
            (PermissionService.prototype.updatePermissions as jest.Mock).mockResolvedValue(updatedPermissions);

            const res = await request(app).put('/permission').send(validPayload);

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(updatedPermissions);
        });
    });

    // ==================== DELETE PERMISSIONS ====================
    describe('DELETE /permission', () => {
        it('should delete all permissions if permissions list is empty', async () => {
            (PermissionService.prototype.deletePermissions as jest.Mock).mockResolvedValue({ count: 5 });

            const res = await request(app).delete('/permission').send({ userId: 1 });

            expect(res.status).toBe(200);
            expect(res.body.data.message).toBe('All permissions removed');
            expect(PermissionService.prototype.deletePermissions).toHaveBeenCalledWith(1);
        });

        it('should delete specific permissions if provided', async () => {
            const remainingPermissions = {
                user: { id: 1, role: 'USER' },
                permissions: ['CONTENT_VIEW']
            };
            (PermissionService.prototype.deleteSpecificPermissions as jest.Mock).mockResolvedValue(remainingPermissions);

            const res = await request(app).delete('/permission').send({ userId: 1, permissions: ['CONTENT_CREATE'] });

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(remainingPermissions);
        });

        it('should return 400 if userId is missing', async () => {
            const res = await request(app).delete('/permission').send({});
            expect(res.status).toBe(400);
        });
    });
});
