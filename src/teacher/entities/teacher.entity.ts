import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity('teachers')
export class TeacherEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @Column()
  @ApiProperty({ description: 'Teacher name' })
  name: string;

  @Column()
  @ApiProperty({ description: 'Teacher email' })
  email: string;

  @Column()
  @ApiProperty({ description: 'Teacher password' })
  @Exclude()
  password: string;

  @ApiProperty({
    description: 'Teacher role',
    enum: UserRole,
    default: UserRole.TEACHER,
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.TEACHER,
  })
  role: UserRole;

  @Column()
  @ApiProperty({ description: 'Teacher contact number' })
  contactNo: string;

  @Column()
  @ApiProperty({ description: 'Teacher line id' })
  lineId: string;

  @Column()
  @ApiProperty({ description: 'Teacher address' })
  address: string;

  @Column()
  @ApiProperty({ description: 'Teacher profile picture' })
  profilePicture: string;

  @Column({
    nullable: true,
  })
  @ApiProperty({ description: 'Teacher profile key' })
  profileKey: string;
}
