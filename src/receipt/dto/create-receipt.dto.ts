import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString } from 'class-validator';

export class CreateReceiptDto {
  @ApiProperty({ description: 'Invoice ID this receipt is for' })
  @IsInt()
  invoiceId: number;

  @ApiProperty({ description: 'Receipt date in ISO format' })
  @IsDateString()
  date: string;
}
