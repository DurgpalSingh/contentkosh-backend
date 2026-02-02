import { Router } from 'express';
import userRoutes from './user.routes';
import businessRoutes from './business.routes';
import examRoutes from './exam.routes';
import announcementRoutes from './announcement.routes';
import batchRoutes from './batch.routes';
import permissionRoutes from './permission.routes';
import contentRoutes from './content.routes';
import teacherRoutes from './teacher.routes';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Health check route '/health'
router.use(healthRoutes);

// API routes
router.use('/api/auth', authRoutes);
router.use('/api', userRoutes);
router.use('/api/business', authenticate, businessRoutes);
router.use('/api/exams', authenticate, examRoutes);
router.use('/api/announcements', authenticate, announcementRoutes);
router.use('/api/batches', authenticate, batchRoutes);
router.use('/api/permission', authenticate, permissionRoutes);
router.use('/api', contentRoutes);
router.use('/api/teachers', authenticate, teacherRoutes);

export default router; 