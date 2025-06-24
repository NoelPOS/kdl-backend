import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from 'src/user/user.module';

import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import configuration from '../config/configuration';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from '../database/data-source';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HttpExceptionFilter } from 'src/common/exception/http-exception.filter';
import { CommonModule } from 'src/common/common.module';
import * as Joi from 'joi';
import { ResendModule } from 'nestjs-resend';
import { SharedModule } from '../shared/shared.module';
import { CourseModule } from 'src/course/course.module';
import { ScheduleModule } from 'src/schedule/schedule.module';
import { RoomModule } from 'src/room/room.module';
import { DiscountModule } from 'src/discount/discount.module';
import { SessionModule } from 'src/session/session.module';

@Module({
  imports: [
    // Environment Configuration
    ConfigModule.forRoot({
      envFilePath: [
        `${process.cwd()}/.env.${process.env.NODE_ENV}`,
        `${process.cwd()}/.env`,
      ],
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_ENABLED: Joi.boolean().default(false),
        DATABASE_URL: Joi.string().when('DATABASE_ENABLED', {
          is: true,
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('1h'),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
        THROTTLE_TTL: Joi.number().default(60),
        THROTTLE_LIMIT: Joi.number().default(10),
      }),
    }),

    ResendModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        apiKey: config.get<string>('RESEND_API_KEY'),
      }),
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('THROTTLE_TTL'),
          limit: config.get('THROTTLE_LIMIT'),
        },
      ],
    }),

    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    // Common modules
    CommonModule,

    // Application Modules
    AuthModule,
    UserModule,
    SharedModule,
    CourseModule,
    ScheduleModule,
    RoomModule,
    DiscountModule,
    SessionModule,
  ],
  providers: [
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Uncomment to apply authentication globally
    // {
    //   provide: APP_GUARD,
    //   useClass: AuthenticationGuard,
    // },

    // Global Filters
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
