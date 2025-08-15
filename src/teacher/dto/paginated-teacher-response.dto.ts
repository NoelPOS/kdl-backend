import { ApiProperty } from '@nestjs/swagger';
import { TeacherEntity } from '../entities/teacher.entity';

export class PaginationMetadata {
  @ApiProperty({ description: 'Current page number' })
  currentPage: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Total number of items' })
  totalCount: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}

export class PaginatedTeacherResponseDto {
  @ApiProperty({
    type: [TeacherEntity],
    description: 'Array of teachers',
  })
  teachers: TeacherEntity[];

  @ApiProperty({
    type: PaginationMetadata,
    description: 'Pagination metadata',
  })
  pagination: PaginationMetadata;
}
