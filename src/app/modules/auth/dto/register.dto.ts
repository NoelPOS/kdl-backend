import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsAlphanumeric,
  IsDefined,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @ApiProperty({
    description: 'Username for the user',
    example: 'user123',
    required: true,
    maxLength: 30,
    minLength: 3,
  })
  @IsNotEmpty()
  @IsString()
  @IsAlphanumeric()
  @MinLength(3, { message: 'Username should be at least 3 characters long' })
  @MaxLength(30, { message: 'Username should not exceed 30 characters' })
  userName: string;

  @ApiProperty({
    description: 'Password for the user',
    example: 'StrongPassword123!',
    required: true,
    minLength: 8,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password should be at least 8 characters long' })
  @MaxLength(50, { message: 'Password should not exceed 50 characters' })
  @IsDefined({ message: 'Password is required' })
  password: string;
}
