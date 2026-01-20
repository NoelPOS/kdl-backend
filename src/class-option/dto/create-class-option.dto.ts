import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  IsPositive,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateClassOptionDto {
  @ApiProperty({ description: 'Class mode (e.g., online, offline, hybrid)' })
  @IsString()
  classMode: string;

  @ApiProperty({ description: 'Maximum number of students in class' })
  @IsNumber()
  @IsPositive()
  classLimit: number;

  @ApiProperty({ description: 'Tuition fee for this class option' })
  @IsNumber()
  @Min(0)
  tuitionFee: number;

  @ApiProperty({ description: 'Date when this option becomes effective' })
  @IsDateString()
  effectiveStartDate: string;

  @ApiProperty({
    description: 'Date when this option expires (optional)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effectiveEndDate?: string;

  @ApiProperty({
    description: 'Option type: camp, fixed, or check',
    enum: ['camp', 'fixed', 'check'],
    required: false,
    default: 'check',
  })
  @IsOptional()
  @IsString()
  optionType?: string;
}
