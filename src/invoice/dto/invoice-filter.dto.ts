import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InvoiceFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Session ID to filter by' })
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @ApiPropertyOptional({ description: 'Student ID to filter by' })
  @IsOptional()
  @IsInt()
  studentId?: number;

  @ApiPropertyOptional({ description: 'Course name to filter by' })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiPropertyOptional({ description: 'Document ID to filter by' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Payment method to filter by' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Receipt done status to filter by' })
  @IsOptional()
  @IsString()
  receiptDone?: string;
}
