import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ReceiptFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Invoice ID to filter by' })
  @IsOptional()
  @IsInt()
  invoiceId?: number;

  @ApiPropertyOptional({ description: 'Session ID to filter by' })
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @ApiPropertyOptional({ description: 'Student ID to filter by' })
  @IsOptional()
  @IsInt()
  studentId?: number;

  @ApiPropertyOptional({ description: 'Course ID to filter by' })
  @IsOptional()
  @IsInt()
  courseId?: number;

  @ApiPropertyOptional({ description: 'Receipt number to search for' })
  @IsOptional()
  @IsString()
  receiptNumber?: string;
}
