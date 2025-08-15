import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('document_counters')
export class DocumentCounter {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column({ unique: true })
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @Column({ default: 0 })
  @ApiProperty({ description: 'Counter for documents on this date' })
  counter: number;
}
