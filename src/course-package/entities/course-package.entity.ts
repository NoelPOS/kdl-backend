import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('course_packages')
export class CoursePackage {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Package name, e.g. "Summer Special 5-Pack"' })
  name: string;

  @Column({ type: 'int' })
  @ApiProperty({ description: 'Number of classes included in this package' })
  numberOfCourses: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({ description: 'Date when this package version becomes effective' })
  effectiveStartDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  @ApiProperty({ description: 'Package price (null for legacy rows pending backfill)', nullable: true, example: 5000 })
  price: number | null;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Date when this package version expires (null = currently active)', nullable: true })
  effectiveEndDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
