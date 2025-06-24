import { ApiProperty } from '@nestjs/swagger';
import { Schedule } from 'src/schedule/entities/schedule.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
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
