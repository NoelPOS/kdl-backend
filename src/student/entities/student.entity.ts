import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('students')
export class StudentEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Student name' })
  name: string;

  @Column()
  @ApiProperty({ description: 'Student nickname' })
  nickname: string;

  @Column()
  @ApiProperty({ description: 'Student date of birth' })
  dob: string;

  @Column()
  @ApiProperty({ description: 'Student gender' })
  gender: string;

  @Column()
  @ApiProperty({ description: 'Student school' })
  school: string;

  @Column(
    'text',
    { array: true, default: () => 'ARRAY[]::text[]' }, // Default to an empty array if no allergies are provided
  )
  @ApiProperty({ description: 'Student allergic' })
  allergic: string[];

  @Column(
    'text',
    { array: true, default: () => 'ARRAY[]::text[]' }, // Default to an empty array if no foods are provided
  )
  @ApiProperty({ description: 'Student do not eat' })
  doNotEat: string[];

  @Column()
  @ApiProperty({ description: 'Student ad concentrate' })
  adConcent: boolean;

  @Column()
  @ApiProperty({ description: 'Student phone number' })
  phone: string;

  @Column()
  @ApiProperty({ description: 'Profile picture URL' })
  profilePicture: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Profile picture key' })
  profileKey: string;
}
