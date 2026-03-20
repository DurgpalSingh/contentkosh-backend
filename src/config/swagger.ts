import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';
import { swaggerSchemas, swaggerParameters, swaggerResponses } from './swagger-schemas';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Contentkosh API',
      version: '1.0.0',
      description: 'Backend API for Contentkosh application',
      contact: {
        name: 'API Support',
        email: 'support@contentkosh.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: swaggerSchemas,
      parameters: swaggerParameters,
      responses: swaggerResponses
    }
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

export const specs = swaggerJsdoc(options);
