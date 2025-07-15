import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { UserEntity } from './entities/user.entity';
import { CommonModule } from '../common/common.module';
import { StudentEntity } from './entities/student.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherCourseEntity } from './entities/teacher-course.entity';
import { ParentEntity } from './entities/parent.entity';
import { ParentStudentEntity } from './entities/parent-student.entity';
import { Session } from '../session/entities/session.entity';
import { CourseEntity } from '../course/entities/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      StudentEntity,
      TeacherEntity,
      TeacherCourseEntity,
      Session,
      ParentEntity,
      ParentStudentEntity,
      CourseEntity,
    ]),
    CommonModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
