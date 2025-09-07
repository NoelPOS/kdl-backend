import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserEntity } from '../user/entities/user.entity';
import { StudentEntity } from '../student/entities/student.entity';
import { CourseEntity } from '../course/entities/course.entity';
import { Session } from '../session/entities/session.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Receipt } from '../receipt/entities/receipt.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      StudentEntity,
      CourseEntity,
      Session,
      Invoice,
      Receipt,
      TeacherEntity
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
