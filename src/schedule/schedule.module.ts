import { Module, forwardRef } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { UserEntity } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { ParentModule } from '../parent/parent.module';
import { LineModule } from '../line/line.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, TeacherEntity]),
    NotificationModule,
    ParentModule,
    forwardRef(() => LineModule),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService], // Export so other modules can use it
})
export class ScheduleModule {}
