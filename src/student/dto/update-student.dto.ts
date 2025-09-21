import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class UpdateStudentDto {
  @ApiProperty({
    example: 57,
    description: 'Student ID (optional, for frontend convenience)',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'ID must be a number' })
  id?: number;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the student',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    example: 'Johnny',
    description: 'Nickname of the student',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Nickname must be a string' })
  @IsNotEmpty({ message: 'Nickname cannot be empty' })
  @MinLength(1, { message: 'Nickname must be at least 1 character long' })
  @MaxLength(50, { message: 'Nickname cannot exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  nickname?: string;

  @ApiProperty({
    example: '1234567890123',
    description: 'National ID of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  nationalId?: string;

  @ApiProperty({
    example: '2005-05-15',
    description: 'Date of birth of the student in YYYY-MM-DD format',
    required: false,
  })
  @IsString()
  @IsOptional()
  dob?: string;

  @ApiProperty({
    example: 'male',
    description: 'Gender of the student',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Gender must be a string' })
  @IsIn(['Male', 'Female', 'male', 'female'], { message: 'Gender must be either Male or Female' })
  @Transform(({ value }) => value?.trim())
  gender?: string;

  @ApiProperty({
    example: 'Springfield High',
    description: 'School of the student',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'School must be a string' })
  @IsNotEmpty({ message: 'School cannot be empty' })
  @MaxLength(200, { message: 'School name cannot exceed 200 characters' })
  school?: string;

  @ApiProperty({
    example: ['Peanuts', 'Shellfish'],
    description: 'List of allergies the student has',
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Allergic must be an array' })
  @IsString({ each: true, message: 'Each allergy item must be a string' })
  allergic?: string[];

  @ApiProperty({
    example: ['Pork', 'Beef'],
    description: 'List of foods the student does not eat',
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'DoNotEat must be an array' })
  @IsString({ each: true, message: 'Each food item must be a string' })
  doNotEat?: string[];

  @ApiProperty({
    example: true,
    description: 'Indicates if the student has ad concentration consent',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Boolean(value) : undefined))
  adConcent?: boolean;

  @ApiProperty({
    example: 33,
    description: "Parent's ID of the student",
    required: false,
  })
  @IsNumber()
  @IsOptional()
  parentId?: number;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number of the student',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone cannot be empty' })
  phone?: string;

  @ApiProperty({
    example:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: "URL of the student's profile picture",
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileKey?: string;
}
