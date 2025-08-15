import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Invoice ID this item belongs to' })
  invoiceId: number;

  @Column()
  @ApiProperty({ description: 'Description of the invoice item' })
  description: string;

  @Column('decimal')
  @ApiProperty({ description: 'Amount for this item' })
  amount: number;

  @ManyToOne('Invoice', 'items')
  @JoinColumn({ name: 'invoiceId' })
  invoice: any;
}
