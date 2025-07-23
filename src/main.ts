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

declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get configuration values with defaults
  const port = configService.get<number>('PORT', 3001);
  const environment = configService.get<string>('NODE_ENV', 'development');
  const swaggerEnabled = configService.get<boolean>(
    'SWAGGER_ENABLED',
    environment === 'development',
  );

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
  app.setGlobalPrefix('api');

  // Swagger Documentation
  if (swaggerEnabled) {
    setupSwagger(app);
  }

  // CORS
  app.enableCors({
    origin: '*', // Adjust as needed
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
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
