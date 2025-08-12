import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

// Use type-only import to avoid circular dependency
import type { Session } from '../../session/entities/session.entity';

@Entity('course_plus')
export class CoursePlus {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Session id' })
  sessionId: number;

  @Column()
  @ApiProperty({ description: 'Additional number of classes' })
  classNo: number;

  @Column()
  @ApiProperty({ description: 'Amount' })
  amount: number;

  @Column()
  @ApiProperty({ description: 'Description' })
  description: string;

  @Column({ default: 'unpaid' })
  @ApiProperty({
    description: 'Payment status',
    default: 'unpaid',
    enum: ['paid', 'unpaid'],
  })
  status: string;

  @Column({ default: false })
  @ApiProperty({ description: 'Invoice generated status', default: false })
  invoiceGenerated: boolean;

  @ManyToOne('Session')
  @JoinColumn({ name: 'sessionId' })
  session: Session;
}
