import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterScheduleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teacherName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  attendanceStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  classStatus?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  classOption?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiProperty({
    required: false,
    description: 'Sort order (e.g., date_asc, date_desc, student_asc, etc.)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiProperty({
    required: false,
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    required: false,
    description: 'Page size for pagination',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({
    required: false,
    description: 'Limit (alias for pageSize) for pagination',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
