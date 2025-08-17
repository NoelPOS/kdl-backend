import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FeedbackFilterDto {
  @ApiProperty({ required: false, description: 'Filter by student name' })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiProperty({ required: false, description: 'Filter by course name' })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiProperty({ required: false, description: 'Filter by teacher name' })
  @IsOptional()
  @IsString()
  teacherName?: string;

  @ApiProperty({
    required: false,
    description: 'Filter from date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'Filter to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    required: false,
    description: 'Status filter (all = fetch all unverified feedbacks)',
    enum: ['all'],
    default: 'all',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    description: 'Items per page',
    minimum: 1,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
