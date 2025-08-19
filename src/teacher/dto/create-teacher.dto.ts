import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsPhoneNumber,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeacherDto {
  @ApiProperty({
    example: 'Teacher1',
    description: 'Teacher name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: 'teacher@gmail.com',
    description: 'Teacher email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  // @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Teacher password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Teacher contact number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Contact number is required' })
  // @IsPhoneNumber(null, { message: 'Invalid contact number format' })
  contactNo: string;

  @ApiProperty({
    example: 'teacher_line_id',
    description: 'Teacher line ID',
  })
  @IsString()
  @IsNotEmpty({ message: 'Line ID is required' })
  lineId: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Teacher address',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Teacher profile picture',
  })
  @IsString()
  @IsNotEmpty({ message: 'Profile picture is required' })
  profilePicture: string;

  @ApiProperty({
    example: 'profile-key-123',
    description: 'Key for the teacher profile picture',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileKey?: string;
}
