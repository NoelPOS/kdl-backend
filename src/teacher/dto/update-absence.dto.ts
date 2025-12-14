import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAbsenceDto {
  @ApiProperty({ description: 'Date of absence', required: false, example: '2025-12-24' })
  @IsOptional()
  @IsDateString()
  absenceDate?: string;

  @ApiProperty({ description: 'Reason for absence', required: false, example: 'Christmas leave' })
  @IsOptional()
  @IsString()
  reason?: string;
}
