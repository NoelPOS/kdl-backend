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
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED');

  // Enable Swagger if explicitly enabled or in non-production environments
  if (!swaggerEnabled && nodeEnv === 'production') {
    return;
  }

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

  // Add custom Swagger configuration
  SwaggerModule.setup('docs', app, document, {
    explorer: true,
    jsonDocumentUrl: '/api/swagger-json',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        theme: 'monokai',
      },
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'KDL API Docs',
    customfavIcon: 'https://nestjs.com/img/favicon.png',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui.min.css',
    ],
  });
};
