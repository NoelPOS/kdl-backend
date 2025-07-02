import {
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCoursePlusScheduleDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsString()
  date: string;

  @ApiProperty()
  @IsString()
  startTime: string;

  @ApiProperty()
  @IsString()
  endTime: string;

  @ApiProperty()
  @IsNumber()
  teacherId: number;

  @ApiProperty()
  @IsString()
  room: string;

  @ApiProperty()
  @IsNumber()
  courseId: number;

  @ApiProperty()
  @IsNumber()
  studentId: number;

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
  warning?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  verifyFb?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  classNumber?: number;
}

export class CreateCoursePlusDto {
  @ApiProperty()
  @IsNumber()
  sessionId: number;

  @ApiProperty()
  @IsNumber()
  classNo: number;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  payment?: boolean;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ type: [CreateCoursePlusScheduleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCoursePlusScheduleDto)
  schedules: CreateCoursePlusScheduleDto[];
}
