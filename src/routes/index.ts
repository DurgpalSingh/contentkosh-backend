import { Router } from 'express';
import userRoutes from './user.routes';
import businessRoutes from './business.routes';
import examRoutes from './exam.routes';
import announcementRoutes from './announcement.routes';
import batchRoutes from './batch.routes';
import courseRoutes from './course.routes';
import healthRoutes from './health.routes';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Health check route '/health'
router.use(healthRoutes);

// API routes
router.use('/api/users', userRoutes);
router.use('/api/business', authenticate, businessRoutes);
router.use('/api/exams', authenticate, examRoutes);
router.use('/api/announcements', authenticate, announcementRoutes);
router.use('/api/batches', authenticate, batchRoutes);
router.use('/api/courses', authenticate, courseRoutes);

export default router; 