import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import {
  ValidationPipe,
  Logger,
  ValidationError,
  BadRequestException,
} from '@nestjs/common';
import { setupSwagger } from './common/docs/swagger';
import { HttpExceptionFilter } from './common/exception/http-exception.filter';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Express v5 compatibility - support complex query strings
  app.set('query parser', 'extended');

  // Get configuration values with defaults
  const port = configService.get<number>('PORT', 3001);
  const environment = configService.get<string>('NODE_ENV', 'development');
  const swaggerEnabledRaw = configService.get('SWAGGER_ENABLED', 'true');

  // Handle both boolean and string values from environment variables
  const swaggerEnabled =
    swaggerEnabledRaw === true || swaggerEnabledRaw === 'true';

  // Global Exception Filter for handling HTTP exceptions
  app.useGlobalFilters(new HttpExceptionFilter());

  // Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert primitive types
      },
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const errors = validationErrors.map((error) => {
          const constraints = error.constraints
            ? Object.values(error.constraints)
            : [];
          return {
            property: error.property,
            message: constraints.length > 0 ? constraints[0] : 'Invalid value',
            constraints: constraints,
            value: error.value,
          };
        });

        return new BadRequestException({
          message: 'Validation failed',
          errors: errors,
        });
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'https://kdl-frontend.vercel.app ,http://localhost:3000,http://54.221.191.226');
  const allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
  
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  await app.listen(port);
  console.log('🔥🔥 SERVER RESTARTED 🔥🔥');

  logger.log(`Application is running in ${environment} mode on port ${port}`);
  logger.log(`Listening on http://localhost:${port}`);
  logger.log(`Environment: ${environment}`);
  if (swaggerEnabled) {
    logger.log(
      `API Documentation available at http://localhost:${port}/api/docs`,
    );
  }
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
