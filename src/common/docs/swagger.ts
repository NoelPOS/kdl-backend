import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sets up Swagger documentation for the API
 * Only enabled in non-production environments by default
 */
export const setupSwagger = (app: INestApplication): void => {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get('NODE_ENV');
  const swaggerEnabledRaw = configService.get('SWAGGER_ENABLED', 'true');

  const swaggerEnabled =
    swaggerEnabledRaw === true || swaggerEnabledRaw === 'true';

  console.log('Swagger Setup Debug:', {
    nodeEnv,
    swaggerEnabledRaw,
    swaggerEnabled,
    baseUrl: configService.get('BASE_URL') || 'http://localhost:3000',
  });

  if (!swaggerEnabled) {
    console.log('Swagger is disabled');
    return;
  }

  console.log('Setting up Swagger...');

  const options = new DocumentBuilder()
    .setTitle('KDL API Documentation')
    .setVersion('1.0.0')
    .setContact('KDL Team', 'https://github.com/NoelPOS', 'u6530183@au.edu')
    .addServer(
      `http://localhost:${configService.get('PORT')}`,
      'Local Development',
    )
    .addServer(`https://kdl-backend.onrender.com`, 'Production Server')
    .addTag('Authentication', 'User authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, options, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Setup Swagger with absolute URLs for production
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/swagger-json',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      // Add this for production
      url: '/swagger-json',
    },
    customSiteTitle: 'KDL API Docs',
    customCss: '.swagger-ui .topbar { display: none }', // Optional: hide topbar
  });

  console.log('Swagger setup completed successfully at /docs');
};
