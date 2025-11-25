import { ApiProperty } from '@nestjs/swagger';
import { StudentEntity } from '../../student/entities/student.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { CourseEntity } from '../../course/entities/course.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';

@Index('idx_schedules_room_date_time', ['room', 'date', 'startTime', 'endTime'])
@Index('idx_schedules_teacher_date_time', [
  'teacherId',
  'date',
  'startTime',
  'endTime',
])
@Index('idx_schedules_student_date_time', [
  'studentId',
  'date',
  'startTime',
  'endTime',
])
@Index('idx_schedules_date', ['date'])
@Index('idx_schedules_studentId', ['studentId'])
@Index('idx_schedules_teacherId', ['teacherId'])
@Index('idx_schedules_room', ['room'])
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

  @Column(
    { nullable: true, type: 'int' }, // Allow teacherId to be nullable
  )
  @ApiProperty({ description: 'Teacher id' })
  teacherId: number;

  @Column({ type: 'date', nullable: true })
  @ApiProperty({ description: 'Date' })
  date: Date;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Start time' })
  startTime: string;

  @Column({ nullable: true })
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

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Date when feedback was submitted' })
  feedbackDate: Date;

  @Column()
  @ApiProperty({ description: 'Verify feedback' })
  verifyFb: boolean;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Name of user who last modified feedback' })
  feedbackModifiedByName?: string;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When feedback was last modified' })
  feedbackModifiedAt?: Date;

  @Column({ 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value: string[] | null | undefined): string | null => {
        if (!value || value.length === 0) return null;
        return value.join(',');
      },
      from: (value: string | null | undefined): string[] => {
        if (!value) return [];
        if (typeof value === 'string' && value.trim() === '') return [];
        if (typeof value === 'string') {
          return value.split(',').filter(url => url.trim().length > 0);
        }
        return [];
      }
    }
  })
  @ApiProperty({ 
    description: 'URLs of feedback images stored in S3', 
    required: false,
    type: [String]
  })
  feedbackImages?: string[];

  @Column({ 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value: string[] | null | undefined): string | null => {
        if (!value || value.length === 0) return null;
        return value.join(',');
      },
      from: (value: string | null | undefined): string[] => {
        if (!value) return [];
        if (typeof value === 'string' && value.trim() === '') return [];
        if (typeof value === 'string') {
          return value.split(',').filter(url => url.trim().length > 0);
        }
        return [];
      }
    }
  })
  @ApiProperty({ 
    description: 'URLs of feedback videos stored in S3', 
    required: false,
    type: [String]
  })
  feedbackVideos?: string[];

  // class number
  @Column({ nullable: true })
  @ApiProperty({ description: 'Class number', required: false })
  classNumber?: number;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Course plus id', required: false })
  coursePlusId?: number;

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

  @ManyToOne(() => Session)
  @JoinColumn({ name: 'sessionId' })
  session: Session;
}
