import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FilterScheduleDto {
  @ApiProperty({ required: true })
  @IsString()
  startDate: string;

  @ApiProperty({ required: true })
  @IsString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentName?: string;
} 