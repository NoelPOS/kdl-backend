import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentEntity } from './entities/student.entity';
import { StudentCounter } from './entities/student-counter.entity';
import { CommonModule } from '../common/common.module';
import { Session } from '../session/entities/session.entity';
import { ParentEntity } from '../parent/entities/parent.entity';
import { ParentStudentEntity } from '../parent/entities/parent-student.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentEntity,
      StudentCounter,
      Session,
      ParentEntity,
      ParentStudentEntity,
    ]),
    CommonModule,
  ],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService, TypeOrmModule],
})
export class StudentModule {}
