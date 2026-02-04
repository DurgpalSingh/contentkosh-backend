import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import compression from 'compression';
import { errorHandler } from './middlewares/error.middleware';
import { config } from './config/config';
import logger from './utils/logger';
import { prisma } from './config/database';
import { specs } from './config/swagger';
import { apiAuditLogger } from './middlewares/audit.middleware';

// Load environment variables
dotenv.config();

const app = express();

async function start() {
  try {
    await prisma.$connect();
    const PORT = config.server.port;

    // Middleware
    app.use(compression());
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Audit Logging
    app.use(apiAuditLogger);

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

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API Base URL: http://localhost:${PORT}/api`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
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