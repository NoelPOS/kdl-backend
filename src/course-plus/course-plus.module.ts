import { Module } from '@nestjs/common';
import { CoursePlusService } from './course-plus.service';
import { CoursePlusController } from './course-plus.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursePlus } from './entities/course-plus.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Session } from '../session/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CoursePlus, Schedule, Session])],
  controllers: [CoursePlusController],
  providers: [CoursePlusService],
})
export class CoursePlusModule {}
