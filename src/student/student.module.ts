import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentEntity } from './entities/student.entity';
import { CommonModule } from '../common/common.module';
import { Session } from '../session/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StudentEntity, Session]), CommonModule],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService, TypeOrmModule],
})
export class StudentModule {}
