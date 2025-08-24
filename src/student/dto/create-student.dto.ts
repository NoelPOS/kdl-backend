import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the student',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Transform(({ value }) => value.trim())
  name: string;

  @ApiProperty({
    example: 'Johnny',
    description: 'Nickname of the student',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nickname is required' })
  @Transform(({ value }) => value.trim())
  nickname: string;

  @ApiProperty({
    example: '1234567890123',
    description: 'National ID of the student',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  nationalId?: string;

  @ApiProperty({
    example: '2005-05-15',
    description: 'Date of birth of the student in YYYY-MM-DD format',
  })
  @IsString()
  @IsNotEmpty({ message: 'Date of birth is required' })
  dob: string;

  @ApiProperty({
    example: 'male',
    description: 'Gender of the student',
  })
  @IsString()
  @IsNotEmpty({ message: 'Gender is required' })
  @Transform(({ value }) => value.trim())
  gender: string;

  @ApiProperty({
    example: 'Springfield High',
    description: 'School of the student',
  })
  @IsString()
  @IsNotEmpty({ message: 'School is required' })
  school: string;

  @ApiProperty({
    example: ['Peanuts', 'Shellfish'],
    description: 'List of allergies the student has',
  })
  @IsArray()
  @IsNotEmpty({ message: 'Allergies are required' })
  allergic: string[];

  @ApiProperty({
    example: ['Pork', 'Beef'],
    description: 'List of foods the student does not eat',
  })
  @IsArray()
  @IsNotEmpty({ message: 'Do not eat list is required' })
  doNotEat: string[];

  @ApiProperty({
    example: true,
    description: 'Indicates if the student has ad concentration consent',
  })
  @IsNotEmpty({ message: 'Ad concentration consent is required' })
  @Transform(({ value }) => Boolean(value))
  adConcent: boolean;

  // parent name
  @ApiProperty({
    example: 'Jane Doe',
    description: "Parent's name of the student",
  })
  @IsString()
  @IsOptional()
  parent?: string;

  @ApiProperty({
    example: 33,
    description: "Parent's ID of the student",
  })
  @IsNumber()
  @IsOptional()
  parentId?: number;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number of the student',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @ApiProperty({
    example:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: "URL of the student's profile picture",
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileKey?: string;
}
