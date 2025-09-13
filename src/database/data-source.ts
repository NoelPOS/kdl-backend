import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import 'dotenv/config';

/**
 * TypeORM configuration for NestJS module
 * Uses ConfigService to load database settings from environment
 */
export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => {
    return {
      type: 'postgres',
      url: configService.get<string>('DATABASE_URL'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: true,
      // Enhanced logging for performance monitoring
      logging:
        configService.get<string>('NODE_ENV') === 'development'
          ? ['query', 'error', 'warn', 'info']
          : ['error', 'warn'],
      // Log slow queries (>500ms) - great for performance monitoring
      maxQueryExecutionTime: 500,
      migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
      migrationsRun: false,
      // Enhanced connection pool optimization for production reliability
      extra: {
        max: 20, // Maximum pool size
        min: 5, // Minimum pool size - keep minimum connections alive
        idleTimeoutMillis: 300000, // 5 minutes - keep connections alive longer
        connectionTimeoutMillis: 10000, // 10 seconds - longer timeout for connection acquisition
        acquireTimeoutMillis: 30000, // 30 seconds - time to wait for available connection
        // PostgreSQL specific settings
        keepAlive: true, // Enable TCP keep-alive
        keepAliveInitialDelayMillis: 10000, // 10 seconds
        // Optimized reconnection settings (less frequent checks for efficiency)
        reapIntervalMillis: 10000, // Check for idle connections every 10 seconds (not 1s)
        createTimeoutMillis: 30000, // 30 seconds to create new connection
        destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
        createRetryIntervalMillis: 1000, // 1 second between retry attempts (not 200ms)

        // CRITICAL: Connection validation to prevent "Connection terminated" errors
        testOnBorrow: true, // Test connection before giving to client (prevents stale connections)
        testOnReturn: false, // Don't test on return (efficiency)
        testOnCreate: true, // Test new connections
        testWhileIdle: true, // Test idle connections
        validationQuery: 'SELECT 1', // Simple health check query
        validationTimeout: 3000, // 3 seconds to validate connection

        // PostgreSQL-specific connection validation
        statement_timeout: 60000, // 60 seconds for query timeout
        query_timeout: 60000, // 60 seconds for query timeout
        idle_in_transaction_session_timeout: 300000, // 5 minutes for idle transactions

        // Network-level keep-alive for long-term connections
        keepAliveInitialDelay: 10000, // 10 seconds initial delay
        keepAliveProbes: 3, // Number of keep-alive probes before giving up
        keepAliveInterval: 10000, // 10 seconds between keep-alive probes
      },
    };
  },
};

/**
 * TypeORM data source options for CLI commands
 * Used for migrations and other TypeORM CLI operations
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Should be false in production
  logging: process.env.NODE_ENV === 'development',
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
};

// Data source instance for TypeORM CLI
const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
