import { ApiProperty } from '@nestjs/swagger';
import { StudentEntity } from '../../user/entities/student.entity';
import { TeacherEntity } from '../../user/entities/teacher.entity';
import { CourseEntity } from '../../course/entities/course.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from 'src/session/entities/session.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Session Id' })
  sessionId: number;

  @Column()
  @ApiProperty({ description: 'Course id' })
  courseId: number;

  @Column()
  @ApiProperty({ description: 'Student id' })
  studentId: number;

  @Column()
  @ApiProperty({ description: 'Teacher id' })
  teacherId: number;

  @Column()
  @ApiProperty({ description: 'Date' })
  date: Date;

  @Column()
  @ApiProperty({ description: 'Start time' })
  startTime: string;

  @Column()
  @ApiProperty({ description: 'End time' })
  endTime: string;

  @Column()
  @ApiProperty({ description: 'Room' })
  room: string;

  @Column()
  @ApiProperty({ description: 'Attendance' })
  attendance: string;

  @Column()
  @ApiProperty({ description: 'Remark' })
  remark: string;

  @Column()
  @ApiProperty({ description: 'Warning message' })
  warning: string;

  @Column()
  @ApiProperty({ description: 'Feedback' })
  feedback: string;

  @Column()
  @ApiProperty({ description: 'Verify feedback' })
  verifyFb: boolean;

  // class number
  @Column({ nullable: true })
  @ApiProperty({ description: 'Class number', required: false })
  classNumber?: number;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;

  @ManyToOne(() => TeacherEntity)
  @JoinColumn({ name: 'teacherId' })
  teacher: TeacherEntity;

  @ManyToOne(() => Session)
  @JoinColumn({ name: 'sessionId' })
  session: Session;
}
