import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Invoice ID this receipt is for' })
  invoiceId: number;

  @Column()
  @ApiProperty({ description: 'Receipt date' })
  date: Date;

  @CreateDateColumn()
  @ApiProperty({ description: 'Receipt creation date' })
  createdAt: Date;

  @OneToOne('Invoice')
  @JoinColumn({ name: 'invoiceId' })
  invoice: any;
}
