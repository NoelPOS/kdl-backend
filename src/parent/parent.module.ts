import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { ParentEntity } from './entities/parent.entity';
import { ParentStudentEntity } from './entities/parent-student.entity';
import { StudentEntity } from '../student/entities/student.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParentEntity,
      ParentStudentEntity,
      StudentEntity,
    ]),
  ],
  controllers: [ParentController],
  providers: [ParentService],
  exports: [ParentService],
})
export class ParentModule {}
