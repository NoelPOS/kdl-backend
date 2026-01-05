import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { UserEntity } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, UserEntity]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
