import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SwapScheduleItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  courseId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  studentId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  teacherId?: number;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  verifyFb?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  classNumber?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warning?: string;
}

export class SwapSessionTypeDto {
  @ApiProperty()
  @IsNumber()
  classOptionId: number;

  @ApiProperty({ type: [SwapScheduleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SwapScheduleItemDto)
  newSchedules: SwapScheduleItemDto[];
}
