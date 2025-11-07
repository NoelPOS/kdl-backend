import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('parents')
export class ParentEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @Column()
  @ApiProperty({ description: 'Parent name' })
  name: string;

  @Column()
  @ApiProperty({ description: 'Parent email' })
  email: string;

  @Column()
  @ApiProperty({ description: 'Parent contact number' })
  contactNo: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Parent LINE user ID (linked after verification)' })
  lineId: string;

  @Column()
  @ApiProperty({ description: 'Parent address' })
  address: string;

  @Column({
    nullable: true,
  })
  @ApiProperty({ description: 'Teacher profile picture' })
  profilePicture: string;

  @Column({
    nullable: true,
  })
  @ApiProperty({ description: 'Parent profile key' })
  profileKey: string;
}
