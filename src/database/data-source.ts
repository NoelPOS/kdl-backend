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
      synchronize: configService.get<string>('NODE_ENV') === 'development',
      logging: configService.get<string>('NODE_ENV') === 'development',
      migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
      migrationsRun: false,
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
