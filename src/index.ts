import 'reflect-metadata';
import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { Server as SocketIOServer } from 'socket.io';
import routes from './routes';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/error.middleware';
import { config } from './config/config';
import logger from './utils/logger';
import { prisma } from './config/database';
import { specs } from './config/swagger';
import { apiAuditLogger } from './middlewares/audit.middleware';
import cron from 'node-cron';
import { auditService } from './services/audit.service';
import { auditConfig } from './config/audit.config';
import { registerAnnouncementSocket } from './sockets/announcement.socket';
import { FILE_STORAGE_CONFIG } from './config/fileStorage.config';
import { authenticate } from './middlewares/auth.middleware';
import { authorizeUploadedFileAccess } from './middlewares/uploadedFileAccess.middleware';

// Load environment variables
dotenv.config();

const app = express();

async function start() {
  try {
    await prisma.$connect();
    const PORT = config.server.port;

    // Middleware
    app.use(compression());
    app.use(cors({
      origin: config.server.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-Slug'],
    }));
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Only email assets are public. Every other upload needs login and must belong to the viewer's business.
    app.use(FILE_STORAGE_CONFIG.publicAssetsUrlPrefix, express.static(FILE_STORAGE_CONFIG.publicAssetsDir));
    app.use(
      FILE_STORAGE_CONFIG.publicUrlPrefix,
      authenticate,
      authorizeUploadedFileAccess,
      express.static(FILE_STORAGE_CONFIG.uploadsRootDir, { cacheControl: false }),
    );

    // Audit Logging
    app.use(apiAuditLogger);

    // Tenant resolver: sets up request context with tenant info from header/params/query
    const { tenantResolver } = await import('./middlewares/tenant.middleware');
    app.use(tenantResolver);

    // Schedule Audit Cleanup (Daily at midnight)
    // Schedule Audit Cleanup (Daily at midnight)
    cron.schedule(auditConfig.cleanupSchedule, async () => {
      logger.info('Running scheduled audit cleanup...');
      try {
        const deletedCount = await auditService.cleanupOldAudits();
        logger.info(`Audit cleanup complete. Deleted ${deletedCount} old logs.`);
      } catch (error) {
        logger.error('Audit cleanup failed:', error);
      }
    });

    // Swagger Documentation
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Contentkosh API Documentation'
    }));

    // Swagger JSON endpoint
    app.get('/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Routes
    app.use('/', routes);

    // Error handling middleware
    app.use(errorHandler);

    const httpServer = http.createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.server.frontendUrl,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    });
    registerAnnouncementSocket(io);

    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API Base URL: http://localhost:${PORT}/api`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`Socket.IO enabled (announcements)`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (e) => {
  console.error('unhandledRejection', e);
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  console.error('uncaughtException', e);
  process.exit(1);
});

start();