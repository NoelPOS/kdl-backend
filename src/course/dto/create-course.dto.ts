import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({
    example: 'Introduction to Programming',
    description: 'Title of the course',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    example: 'A beginner-friendly course on programming concepts.',
    description: 'Description of the course',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({
    example: '10-15',
    description: 'Age range suitable for the course',
  })
  @IsString()
  @IsNotEmpty({ message: 'Age range is required' })
  ageRange: string;

  @ApiProperty({
    example: 'Online',
    description: 'Medium of the course delivery',
  })
  @IsString()
  @IsNotEmpty({ message: 'Medium is required' })
  medium: string;
}
