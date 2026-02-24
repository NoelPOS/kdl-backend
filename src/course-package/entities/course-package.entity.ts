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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
