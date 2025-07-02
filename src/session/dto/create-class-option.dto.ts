import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsPositive } from 'class-validator';

export class CreateClassOptionDto {
  @ApiProperty({ description: 'Class mode' })
  @IsString()
  classMode: string;

  @ApiProperty({ description: 'Class limit' })
  @IsNumber()
  @IsPositive()
  classLimit: number;

  @ApiProperty({ description: 'Tuition fee' })
  @IsNumber()
  @Min(0)
  tuitionFee: number;
}
