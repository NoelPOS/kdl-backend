import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { TokenStorageService } from './services/token-storage.service';
import { AuthCleanupService } from './auth-cleanup.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { AuthController } from './controllers/auth.controller';
import { CommonModule } from '../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { TeacherModule } from '../teacher/teacher.module';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { ParentEntity } from '../parent/entities/parent.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserEntity, TeacherEntity, PasswordResetTokenEntity, ParentEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1d'),
        },
      }),
    }),
    UserModule,
    TeacherModule,
    CommonModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenStorageService, AuthCleanupService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
