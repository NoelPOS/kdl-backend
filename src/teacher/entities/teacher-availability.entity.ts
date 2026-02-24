import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Index('idx_teacher_availability_teacher_day', ['teacherId', 'dayOfWeek'])
@Entity('teacher_availability')
export class TeacherAvailability {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column({ type: 'int' })
  @ApiProperty({ description: 'Teacher ID' })
  teacherId: number;

  @Column({ type: 'varchar', length: 15 })
  @ApiProperty({ description: 'Day of week (Monday, Tuesday, etc.)' })
  dayOfWeek: string;

  @Column({ type: 'varchar', length: 10 })
  @ApiProperty({ description: 'Availability start time (HH:mm)' })
  startTime: string;

  @Column({ type: 'varchar', length: 10 })
  @ApiProperty({ description: 'Availability end time (HH:mm)' })
  endTime: string;

  @CreateDateColumn()
  createdAt: Date;
}
