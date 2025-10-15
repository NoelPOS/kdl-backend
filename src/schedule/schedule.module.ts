import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, TeacherEntity])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
