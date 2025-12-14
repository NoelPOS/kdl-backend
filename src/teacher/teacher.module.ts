import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherCourseEntity } from './entities/teacher-course.entity';
import { TeacherAbsence } from './entities/teacher-absence.entity';
import { CommonModule } from '../common/common.module';
import { Session } from '../session/entities/session.entity';
import { CourseEntity } from '../course/entities/course.entity';
import { Schedule } from '../schedule/entities/schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherEntity,
      TeacherCourseEntity,
      TeacherAbsence,
      Session,
      CourseEntity,
      Schedule,
    ]),
    CommonModule,
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService, TypeOrmModule],
})
export class TeacherModule {}

