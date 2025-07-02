import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateDiscountDto {
  @ApiProperty({ example: 'Summer Sale', description: 'Title of the discount' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'admission',
    description: 'Usage category like "admission" or "promotion"',
  })
  @IsString()
  @IsNotEmpty()
  usage: string;

  @ApiProperty({ example: 2000, description: 'The discount amount' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
