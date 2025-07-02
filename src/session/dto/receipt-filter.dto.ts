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

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  invoiceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sessionId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  studentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  courseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNumber?: string;
}
