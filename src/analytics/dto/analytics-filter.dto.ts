import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsFilterDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Target teacher ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  teacherId?: number;

  @ApiPropertyOptional({ 
    description: 'Count by timeslot (teacher perspective) or enrollment (student perspective)',
    enum: ['timeslot', 'enrollment']
  })
  @IsOptional()
  @IsString()
  @IsIn(['timeslot', 'enrollment'])
  countBy?: 'timeslot' | 'enrollment';
}
