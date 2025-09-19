import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CourseEntity } from '../../course/entities/course.entity';
import { StudentEntity } from '../../student/entities/student.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { ClassOption } from '../../class-option/entities/class-option.entity';

// Add indexes for frequently queried columns
@Index('idx_sessions_student_course', ['studentId', 'courseId'])
@Index('idx_sessions_teacher', ['teacherId'])
@Index('idx_sessions_status', ['status'])
@Index('idx_sessions_payment', ['payment'])
@Index('idx_sessions_package_group', ['packageGroupId'])
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Student id' })
  studentId: number;

  @Column()
  @ApiProperty({ description: 'Course id' })
  courseId: number;

  @Column()
  @ApiProperty({
    description: 'courseOptionId',
  })
  classOptionId: number;

  @Column()
  @ApiProperty({ description: 'Class cancel' })
  classCancel: number;

  @Column()
  @ApiProperty({ description: 'Payment' })
  payment: string;

  @Column()
  @ApiProperty({ description: 'Status' })
  status: string;

  @Column({ nullable: true, type: 'int' })
  @ApiProperty({ description: 'Teacher id' })
  teacherId: number;

  @Column({ default: false })
  @ApiProperty({ description: 'Invoice done' })
  invoiceDone: boolean;

  @Column({ nullable: true, type: 'int' })
  @ApiProperty({ description: 'Package group id for linking package and TBC sessions', required: false })
  packageGroupId?: number;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({ description: 'Session comment', required: false })
  comment?: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Session creation date' })
  createdAt: Date;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;

  @ManyToOne(() => TeacherEntity, {
    nullable: true,
  })
  @JoinColumn({ name: 'teacherId' })
  teacher: TeacherEntity;

  @ManyToOne(() => ClassOption)
  @JoinColumn({ name: 'classOptionId' })
  classOption: ClassOption;
}
