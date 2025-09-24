import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('student_counters')
export class StudentCounter {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column({ unique: true })
  @ApiProperty({ description: 'Year and month in YYYYMM format' })
  yearMonth: string;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Counter for students registered in this month' })
  counter: number;
}
