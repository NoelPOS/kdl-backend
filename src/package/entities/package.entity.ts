import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('packages')
export class PackageEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @Column()
  @ApiProperty({ description: 'Student name' })
  studentName: string;

  @Column()
  @ApiProperty({ description: 'Class option ID' })
  classOptionId: number;

  @Column()
  @ApiProperty({ description: 'Class option title' })
  classOptionTitle: string;

  @Column()
  @ApiProperty({ description: 'Class mode' })
  classMode: string;

  @Column('decimal', { precision: 10, scale: 2 })
  @ApiProperty({ description: 'Tuition fee' })
  tuitionFee: number;

  @Column()
  @ApiProperty({ description: 'Class limit' })
  classLimit: number;

  @Column({ type: 'date' })
  @ApiProperty({ description: 'Purchase date' })
  purchaseDate: Date;

  @Column({
    type: 'enum',
    enum: ['used', 'not_used'],
    default: 'not_used',
  })
  @ApiProperty({
    description: 'Package status',
    enum: ['used', 'not_used'],
    default: 'not_used',
  })
  status: 'used' | 'not_used';

  @Column({ default: false })
  @ApiProperty({ description: 'Whether the package is redeemed' })
  isRedeemed: boolean;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Redemption date', required: false })
  redeemedAt?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Redeemed course ID', required: false })
  redeemedCourseId?: number;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Redeemed course name', required: false })
  redeemedCourseName?: string;

  @Column({ default: false })
  @ApiProperty({ description: 'Invoice generated status', default: false })
  invoiceGenerated: boolean;

  @Column({ default: false })
  @ApiProperty({ description: 'Receipt generated status', default: false })
  receiptGenerated: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
