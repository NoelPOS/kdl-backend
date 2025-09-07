import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsDateString,
} from 'class-validator';

export class UpdateScheduleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  attendance?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiProperty({
    required: false,
    description: 'Date when feedback was submitted',
  })
  @IsOptional()
  @IsDateString()
  feedbackDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  verifyFb?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  teacherId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  courseId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teacherName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warning?: string;
}
