import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseErrorInterceptor } from './database-error.interceptor';

/**
 * Database Module
 * Provides global database error handling and connection management
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseErrorInterceptor,
    },
  ],
  exports: [],
})
export class DatabaseModule {}
