import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('courses')
export class CourseEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Course title' })
  title: string;

  @Column()
  @ApiProperty({ description: 'Course description' })
  description: string;

  @Column()
  @ApiProperty({ description: 'Course age range' })
  ageRange: string;

  @Column()
  @ApiProperty({ description: 'Course learning medium' })
  medium: string;
}
