import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TeacherSessionFilterDto {
  @ApiProperty({
    required: false,
    description: 'Filter by course name',
    example: 'Mathematics',
  })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by status',
    enum: ['completed', 'wip'],
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    minimum: 1,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 12;
}
