import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { CourseEntity } from '../../course/entities/course.entity';
import { StudentEntity } from '../../user/entities/student.entity';
import { CoursePlus } from '../../course-plus/entities/course-plus.entity';

// --- ClassOption Entity ---
@Entity('class_options')
export class ClassOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  classMode: string;

  @Column()
  classLimit: number;

  @Column('decimal')
  tuitionFee: number;

  @Column()
  effectiveStartDate: Date;

  @Column({ nullable: true })
  effectiveEndDate: Date;
}

// --- Session Entity ---
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Student id' })
  studentId: number;

  @Column()
  @ApiProperty({ description: 'Course id' })
  courseId: number;

  @Column()
  @ApiProperty({
    description: 'courseOptionId',
  })
  classOptionId: number;

  @Column()
  @ApiProperty({ description: 'Class cancel' })
  classCancel: number;

  @Column()
  @ApiProperty({ description: 'Payment' })
  payment: string;

  @Column()
  @ApiProperty({ description: 'Status' })
  status: string;

  @Column({ default: false })
  @ApiProperty({ description: 'Invoice done' })
  invoiceDone: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: 'Session creation date' })
  createdAt: Date;

  @ManyToOne(() => CourseEntity)
  @JoinColumn({ name: 'courseId' })
  course: CourseEntity;

  @ManyToOne(() => StudentEntity)
  @JoinColumn({ name: 'studentId' })
  student: StudentEntity;

  @OneToOne(() => ClassOption)
  @JoinColumn({ name: 'classOptionId' })
  classOption: ClassOption;
}

// --- Invoice Entity ---
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  documentId: string;

  @Column()
  date: Date;

  @Column()
  paymentMethod: string;

  @Column('decimal')
  totalAmount: number;

  @Column({ nullable: true })
  sessionId: number;

  @Column({ nullable: true })
  coursePlusId: number;

  @Column({ default: false })
  receiptDone: boolean;

  @OneToOne(() => CoursePlus)
  @JoinColumn({ name: 'coursePlusId' })
  coursePlus: CoursePlus;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];
}

// --- InvoiceItem Entity ---
@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoiceId: number;

  @Column()
  description: string;

  @Column('decimal')
  amount: number;

  @ManyToOne(() => Invoice, (invoice) => invoice.items)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;
}

// --- Receipt Entity ---
@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoiceId: number;

  @OneToOne(() => Invoice)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column()
  date: Date;
}
