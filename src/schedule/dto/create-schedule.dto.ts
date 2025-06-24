import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsInt()
  sessionId: number;

  @ApiProperty()
  @IsInt()
  courseId: number;

  @ApiProperty()
  @IsInt()
  studentId: number;

  @ApiProperty()
  @IsInt()
  teacherId: number;

  @ApiProperty()
  @IsString()
  date: string;

  @ApiProperty()
  @IsString()
  startTime: string;

  @ApiProperty()
  @IsString()
  endTime: string;

  @ApiProperty()
  @IsString()
  room: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  attendance: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  remark: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  feedback: string;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  verifyFb: boolean;

  // class number
  @ApiProperty()
  @IsOptional()
  @IsInt()
  classNumber?: number;
}
