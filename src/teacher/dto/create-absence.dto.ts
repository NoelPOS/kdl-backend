import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAbsenceDto {
  @ApiProperty({ description: 'Date of absence', example: '2025-12-24' })
  @IsDateString()
  absenceDate: string;

  @ApiProperty({ description: 'Reason for absence', required: false, example: 'Christmas leave' })
  @IsOptional()
  @IsString()
  reason?: string;
}
