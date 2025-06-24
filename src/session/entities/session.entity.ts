import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CourseEntity } from 'src/course/entities/course.entity';

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
  @ApiProperty({ description: 'Mode' })
  mode: string;

  @Column()
  @ApiProperty({ description: 'Class limit' })
  classLimit: number;

  @Column()
  @ApiProperty({ description: 'Class cancel' })
  classCancel: number;

  @Column()
  @ApiProperty({ description: 'Payment' })
  payment: string;

  @Column()
  @ApiProperty({ description: 'Status' })
  status: string;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;
}
