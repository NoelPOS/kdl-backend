import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('document_counters')
@Index(['date'], { unique: true })
export class DocumentCounter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  @ApiProperty({ description: 'Date for the counter (YYYY-MM-DD)' })
  date: string;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Last used counter for this date' })
  counter: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
