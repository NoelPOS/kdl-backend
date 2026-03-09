import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

// Only effectiveEndDate is mutable after creation.
// name and numberOfCourses are frozen — create a new version instead.
export class UpdateCoursePackageDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Set to deactivate this package version',
    example: '2026-12-31',
  })
  effectiveEndDate?: string;
}
