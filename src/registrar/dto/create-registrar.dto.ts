import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrarDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Registrar name (will be mapped to userName)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: 'registrar@example.com',
    description: 'Registrar email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Registrar password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    example: 'https://kdl-image.s3.amazonaws.com/registrars/kdl_logo.jpg',
    description: 'Registrar profile picture URL',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({
    example: 'registrars/kdl_logo.jpg',
    description: 'Key for the registrar profile picture in S3',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileKey?: string;
}