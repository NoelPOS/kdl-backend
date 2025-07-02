import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('course_plus')
export class CoursePlus {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Session id' })
  sessionId: number;

  @Column()
  @ApiProperty({ description: 'Additional number of classes' })
  classNo: number;

  @Column()
  @ApiProperty({ description: 'Amount' })
  amount: number;

  @Column({ default: false })
  @ApiProperty({ description: 'Payment status', default: false })
  payment: boolean;

  @Column()
  @ApiProperty({ description: 'Description' })
  description: string;
}
