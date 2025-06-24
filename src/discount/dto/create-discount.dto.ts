import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateDiscountDto {
  @ApiProperty({ example: 'Summer Sale', description: 'Title of the discount' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 15.5, description: 'The discount amount' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
