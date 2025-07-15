import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CheckScheduleConflictDto {
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
  @IsNumber()
  teacherId: number;

  @ApiProperty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  courseTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  excludeId?: number;
}
