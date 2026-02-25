import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import dashboardRoutes from '../../../src/routes/dashboard.routes';
import * as dashboardService from '../../../src/services/dashboard.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../src/errors/api.errors';

jest.mock('../../../src/services/dashboard.service');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, _res: any, next: any) => {
        if (req.headers['x-no-user'] === 'true') {
            next();
            return;
        }

        req.user = {
            id: Number(req.headers['x-user-id'] || 1),
            role: (req.headers['x-role'] as string) || 'ADMIN',
            businessId: Number(req.headers['x-business-id'] || 1),
            email: 'test@example.com',
            name: 'Tester'
        };
        next();
    }
}));

const app = express();
app.use(express.json());
app.use('/api', dashboardRoutes);

describe('Dashboard Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return admin dashboard data', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockResolvedValue({
            stats: {
                totalUsers: 10,
                totalTeachers: 2,
                totalStudents: 8,
                totalExams: 3,
                totalCourses: 6,
                totalBatches: 4,
                totalContent: 55,
                activeAnnouncements: 2
            },
            recentUsers: [],
            recentAnnouncements: []
        });

        const res = await request(app).get('/api/dashboard').set('x-role', 'ADMIN');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stats.totalUsers).toBe(10);
        expect(res.body.data.upcomingExams).toBeUndefined();
    });

    it('should return teacher dashboard data', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockResolvedValue({
            stats: {
                totalBatches: 2,
                totalStudents: 21,
                totalContent: 9,
                activeAnnouncements: 1
            },
            myBatches: [],
            recentAnnouncements: [],
            recentContent: []
        });

        const res = await request(app).get('/api/dashboard').set('x-role', 'TEACHER');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stats.totalBatches).toBe(2);
    });

    it('should return 401 when req.user is missing', async () => {
        const res = await request(app).get('/api/dashboard').set('x-no-user', 'true');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Unauthorized');
    });

    it('should return 400 for BadRequestError from service', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockRejectedValue(
            new BadRequestError('Business ID is required')
        );

        const res = await request(app).get('/api/dashboard').set('x-role', 'ADMIN');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Business ID is required');
    });

    it('should return 404 for NotFoundError from service', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockRejectedValue(
            new NotFoundError('Business')
        );

        const res = await request(app).get('/api/dashboard').set('x-role', 'ADMIN');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Business not found');
    });

    it('should return 403 for ForbiddenError from service', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockRejectedValue(
            new ForbiddenError('Dashboard not available for your role')
        );

        const res = await request(app).get('/api/dashboard').set('x-role', 'USER');

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Dashboard not available for your role');
    });

    it('should return 400 generic error response for unexpected service errors', async () => {
        (dashboardService.getDashboardByRole as jest.Mock).mockRejectedValue(
            new Error('Unexpected failure')
        );

        const res = await request(app).get('/api/dashboard').set('x-role', 'ADMIN');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Failed to fetch dashboard');
    });
});
