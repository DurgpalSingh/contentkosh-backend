import request from 'supertest';
import express from 'express';
import businessRoutes from '../../../src/routes/business.routes';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { NotFoundError } from '../../../src/errors/api.errors';

// Mock dependencies
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 1, role: 'SUPERADMIN' };
        next();
    },
    authorize: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../../../src/services/business.service', () => ({
    BusinessService: {
        createBusiness: jest.fn(),
        getBusinessBySlug: jest.fn(),
        getBusinessById: jest.fn()
    }
}));

import { BusinessService } from '../../../src/services/business.service';
import { authenticate } from '../../../src/middlewares/auth.middleware';

const app = express();
app.use(express.json());
// Apply mock authenticate which sets req.user
app.use(authenticate);
app.use('/api/business', businessRoutes);
app.use(errorHandler);

describe('Business Slug Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/business', () => {
        it('should create business with slug and logo', async () => {
            const mockBusiness = {
                id: 1,
                instituteName: 'Test Institute',
                slug: 'test-institute',
                logo: 'https://example.com/logo.png',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (BusinessService.createBusiness as jest.Mock).mockResolvedValue(mockBusiness);

            const res = await request(app)
                .post('/api/business')
                .send({
                    instituteName: 'Test Institute',
                    slug: 'test-institute',
                    logo_url: 'https://example.com/logo.png'
                });

            if (res.status !== 201) {
                console.error('Test Failed. Response Body:', JSON.stringify(res.body, null, 2));
                throw new Error(`Expected 201 but got ${res.status}: ${JSON.stringify(res.body)}`);
            }

            expect(res.status).toBe(201);
            expect(res.body.data.slug).toBe('test-institute');
            expect(res.body.data.logo).toBe('https://example.com/logo.png');
        });
    });

    describe('GET /api/business/slug/:slug', () => {
        it('should fetch business by slug', async () => {
            const mockBusiness = {
                id: 1,
                instituteName: 'Test Institute',
                slug: 'test-institute',
                logo: 'https://example.com/logo.png',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (BusinessService.getBusinessBySlug as jest.Mock).mockResolvedValue(mockBusiness);

            const res = await request(app).get('/api/business/slug/test-institute');

            expect(res.status).toBe(200);
            expect(BusinessService.getBusinessBySlug).toHaveBeenCalledWith('test-institute');
            expect(res.body.data.id).toBe(1);
            expect(res.body.data.slug).toBe('test-institute');
        });

        it('should return 404 if slug not found', async () => {
            (BusinessService.getBusinessBySlug as jest.Mock).mockRejectedValue(new NotFoundError('Business not found'));

            const res = await request(app).get('/api/business/slug/non-existent');

            expect(res.status).toBe(404);
        });
    });
});
