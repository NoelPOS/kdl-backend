import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateCoursePackageDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Package name' })
  name?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @ApiPropertyOptional({ description: 'Number of classes in the package' })
  numberOfCourses?: number;
}
