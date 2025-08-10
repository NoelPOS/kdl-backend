import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  amount: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  sessionId?: number | string;

  @ApiProperty({ required: false })
  @IsOptional()
  coursePlusId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  packageId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  studentId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  studentName?: string;

  @ApiProperty()
  @IsString()
  @IsIn(['course', 'courseplus', 'package'])
  transactionType: 'course' | 'courseplus' | 'package';

  @ApiProperty()
  @IsString()
  documentId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  paymentMethod: string;

  @ApiProperty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}
