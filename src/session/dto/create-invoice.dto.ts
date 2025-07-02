import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
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
  @ApiProperty()
  @IsInt()
  sessionId: number;

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
