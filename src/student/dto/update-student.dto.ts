import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class UpdateStudentDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    example: 'Johnny',
    description: 'Nickname of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  nickname?: string;

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
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  gender?: string;

  @ApiProperty({
    example: 'Springfield High',
    description: 'School of the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  school?: string;

  @ApiProperty({
    example: ['Peanuts', 'Shellfish'],
    description: 'List of allergies the student has',
    required: false,
  })
  @IsArray()
  @IsOptional()
  allergic?: string[];

  @ApiProperty({
    example: ['Pork', 'Beef'],
    description: 'List of foods the student does not eat',
    required: false,
  })
  @IsArray()
  @IsOptional()
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
  @IsString()
  @IsOptional()
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
