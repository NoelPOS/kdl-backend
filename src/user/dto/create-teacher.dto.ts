import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsPhoneNumber,
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
  // @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Teacher contact number',
  })
  // @IsPhoneNumber(null, { message: 'Invalid contact number format' })
  @IsNotEmpty({ message: 'Contact number is required' })
  contactNo: string;

  @ApiProperty({
    example: 'teacher_line_id',
    description: 'Teacher line ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  lineId?: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Teacher address',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address: string;
}
