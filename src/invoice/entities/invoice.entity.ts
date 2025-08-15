import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Document ID for the invoice' })
  documentId: string;

  @Column()
  @ApiProperty({ description: 'Invoice date' })
  date: Date;

  @Column()
  @ApiProperty({ description: 'Payment method used' })
  paymentMethod: string;

  @Column('decimal')
  @ApiProperty({ description: 'Total amount of the invoice' })
  totalAmount: number;

  @Column({ default: false })
  @ApiProperty({ description: 'Whether receipt has been generated' })
  receiptDone: boolean;

  @Column()
  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @Column()
  @ApiProperty({ description: 'Student name' })
  studentName: string;

  @Column()
  @ApiProperty({ description: 'Course name' })
  courseName: string;

  @Column('json')
  @ApiProperty({
    description: 'Session groups associated with this invoice',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        transactionType: {
          type: 'string',
          enum: ['course', 'courseplus', 'package'],
        },
        actualId: { type: 'string' },
      },
    },
  })
  sessionGroups: Array<{
    sessionId: string;
    transactionType: 'course' | 'courseplus' | 'package';
    actualId: string;
  }>;

  @CreateDateColumn()
  @ApiProperty({ description: 'Invoice creation date' })
  createdAt: Date;

  @OneToMany('InvoiceItem', 'invoice', { cascade: true })
  @ApiProperty({ description: 'Items in this invoice' })
  items: any[];
}
