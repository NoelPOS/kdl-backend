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

export class InvoiceItemDto {
  @ApiProperty({ description: 'Description of the invoice item' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Amount for this item' })
  @IsNumber()
  amount: number;
}

export class SessionGroupDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['course', 'courseplus', 'package'],
  })
  @IsString()
  @IsIn(['course', 'courseplus', 'package'])
  transactionType: 'course' | 'courseplus' | 'package';

  @ApiProperty({ description: 'The actual ID for the transaction' })
  @IsString()
  actualId: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Student ID' })
  @IsInt()
  studentId: number;

  @ApiProperty({
    description: 'Document ID (optional, will be generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({ description: 'Invoice date in ISO format' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Payment method used' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ description: 'Total amount of the invoice' })
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ description: 'Student name' })
  @IsString()
  studentName: string;

  @ApiProperty({ description: 'Course name' })
  @IsString()
  courseName: string;

  @ApiProperty({
    description: 'Session groups associated with this invoice',
    type: [SessionGroupDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionGroupDto)
  sessionGroups: SessionGroupDto[];

  @ApiProperty({
    description: 'Items in this invoice',
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}
