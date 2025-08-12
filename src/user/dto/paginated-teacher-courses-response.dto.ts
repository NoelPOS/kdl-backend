import { ApiProperty } from '@nestjs/swagger';
import { CourseEntity } from '../../course/entities/course.entity';

export class PaginatedTeacherCoursesResponseDto {
  @ApiProperty({
    description: 'List of courses assigned to the teacher',
    type: [CourseEntity],
  })
  courses: CourseEntity[];

  @ApiProperty({
    description: 'Pagination information',
    type: 'object',
    properties: {
      currentPage: { type: 'number' },
      totalPages: { type: 'number' },
      totalCount: { type: 'number' },
      hasNext: { type: 'boolean' },
      hasPrev: { type: 'boolean' },
    },
  })
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
