import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsDateString } from 'class-validator';

export class CreateReceiptDto {
  @ApiProperty()
  @IsInt()
  invoiceId: number;

  @ApiProperty()
  @IsDateString()
  date: string;
}
