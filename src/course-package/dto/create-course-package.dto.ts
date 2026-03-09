import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNotEmpty,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateCoursePackageDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Package name',
    example: 'Summer Special 5-Pack',
  })
  name: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ description: 'Number of classes in the package', example: 5 })
  numberOfCourses: number;

  @IsDateString()
  @ApiProperty({
    description: 'Date when this package version becomes effective',
    example: '2026-03-01',
  })
  effectiveStartDate: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Date when this package version expires (omit for active)',
    example: '2026-12-31',
  })
  effectiveEndDate?: string;
}
