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

@Entity('registrars')
export class RegistrarEntity {
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
  @ApiProperty({ description: 'Registrar name' })
  name: string;

  @Column({ unique: true })
  @ApiProperty({ description: 'Registrar email' })
  email: string;

  @Column()
  @ApiProperty({ description: 'Registrar password' })
  @Exclude()
  password: string;

  @ApiProperty({
    description: 'Registrar role',
    enum: UserRole,
    default: UserRole.REGISTRAR,
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.REGISTRAR,
  })
  role: UserRole;

  @Column({ default: '' })
  @ApiProperty({ description: 'Registrar profile picture URL' })
  profilePicture: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Profile picture key' })
  profileKey: string;
}