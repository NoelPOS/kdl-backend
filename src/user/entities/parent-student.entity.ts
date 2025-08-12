import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ParentEntity } from './parent.entity';
import { StudentEntity } from './student.entity';

@Entity('parent_student')
@Index(['parentId', 'studentId'], { unique: true }) // Prevent duplicate parent-student connections
export class ParentStudentEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column({ type: 'int' })
  @ApiProperty({ description: 'Parent ID' })
  parentId: number;

  @Column({ type: 'int' })
  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({
    description: 'Whether this parent is the primary contact for the student',
  })
  isPrimary: boolean;

  // Relations
  @ManyToOne(() => ParentEntity)
  @JoinColumn({ name: 'parentId' })
  parent: ParentEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;
}
