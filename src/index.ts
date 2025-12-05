import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { config } from './config/config';
import logger from './utils/logger';
import { prisma } from './config/database';
import { specs } from './config/swagger';

// Load environment variables
dotenv.config();

const app = express();
let server: http.Server | null = null;

async function start() {
  try {
    const PORT = config.server.port;
    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Swagger Documentation
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Contentkosh API Documentation',
      }),
    );

    // Swagger JSON endpoint
    app.get('/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Routes
    app.use('/', routes);

    // Error handling middleware (keep last)
    app.use(errorHandler);

    // Start server
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API Base URL: http://localhost:${PORT}/api`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    logger.error('Fatal startup error:', err);
    try {
      await prisma.$disconnect();
    } catch (e) {
      logger.error('Error disconnecting Prisma after startup failure:', e);
    }
    process.exit(1);
  }
}

async function shutdown(reason: string, exitCode = 0) {
  logger.info(`Shutdown triggered (${reason}). Cleaning up...`);

  try {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    await prisma.$disconnect();
    logger.info('Disconnected from database');
    logger.info('Cleanup complete. Exiting.');
    process.exit(exitCode);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
}

// OS signals (Ctrl+C, Docker/K8s stop, etc.)
process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

// Crash / unhandled errors
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown('uncaughtException', 1);
});

start();