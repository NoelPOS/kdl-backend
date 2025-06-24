import { Entity, Column, OneToMany, Relation, PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Token } from '../../auth/entities/opt.entity';

@Entity('users')
export class UserEntity  {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    example: 'janedoe',
    description: 'Username for login and identification',
  })
  @Column()
  userName: string;

  @ApiProperty({
    example: 'jane_doe@example.com',
    description: 'Email address of the user',
  })
  @Column({ unique: true })
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'User password (hashed when stored)',
  })
  @Column()
  @Exclude()
  password: string;

  @ApiProperty({
    description: 'User role for authorization',
    enum: ['user', 'admin'],
    default: 'user',
  })
  @Column({ type: 'varchar', default: 'user' })
  role: string;

  @ApiProperty({
    description: 'Refresh token for JWT authentication',
    required: false,
  })
  @Column({ nullable: true, type: 'text' })
  @Exclude()
  refreshToken: string;

  @ApiProperty({
    description: 'Indicates whether the user has verified their email',
    default: false,
  })
  @Column({ default: false, type: 'boolean' })
  isVerified: boolean;

  @ApiProperty({
    description: 'Tokens associated with the user',
    type: [Token],
    required: false,
  })
  @OneToMany(() => Token, (token) => token.user, { cascade: true })
  tokens: Relation<Token>[];
}
