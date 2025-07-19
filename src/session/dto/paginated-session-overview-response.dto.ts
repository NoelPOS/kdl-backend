import { ApiProperty } from '@nestjs/swagger';

export class SessionOverview {
  @ApiProperty({
    description: 'Course title',
    example: 'Mathematics Advanced',
  })
  courseTitle: string;

  @ApiProperty({
    description: 'Class mode',
    example: 'Group',
  })
  mode: string;

  @ApiProperty({
    description: 'Number of completed classes',
    example: 10,
  })
  completedCount: number;

  @ApiProperty({
    description: 'Number of cancelled classes',
    example: 2,
  })
  classCancel: number;

  @ApiProperty({
    description: 'Progress percentage',
    example: '70%',
  })
  progress: string;

  @ApiProperty({
    description: 'Session ID',
    example: 123,
  })
  sessionId: number;

  @ApiProperty({
    description: 'Course description',
    example: 'Advanced mathematics course for students',
  })
  courseDescription: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'Paid',
  })
  payment: string;

  @ApiProperty({
    description: 'Medium of instruction',
    example: 'English',
  })
  medium: string;
}

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

export class PaginatedSessionOverviewResponseDto {
  @ApiProperty({
    type: [SessionOverview],
    description: 'Array of session overviews',
  })
  sessions: SessionOverview[];

  @ApiProperty({
    type: PaginationMetadata,
    description: 'Pagination metadata',
  })
  pagination: PaginationMetadata;
}
