import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TeacherEntity } from './teacher.entity';

@Index('idx_teacher_absences_teacher_id', ['teacherId'])
@Index('idx_teacher_absences_date', ['absenceDate'])
@Entity('teacher_absences')
export class TeacherAbsence {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Teacher ID' })
  teacherId: number;

  @Column({ type: 'date' })
  @ApiProperty({ description: 'Date of absence' })
  absenceDate: Date;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Reason for absence', required: false })
  reason?: string;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ManyToOne(() => TeacherEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId' })
  teacher: TeacherEntity;
}


