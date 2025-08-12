import { ApiProperty } from '@nestjs/swagger';
import { ParentStudentEntity } from '../entities/parent-student.entity';
import { StudentEntity } from '../entities/student.entity';

export class ParentChildDto {
  @ApiProperty({ description: 'Parent-child relationship ID' })
  id: number;

  @ApiProperty({ description: 'Parent ID' })
  parentId: number;

  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @ApiProperty({ description: 'Whether this parent is the primary contact' })
  isPrimary: boolean;

  @ApiProperty({
    description: 'Student information',
    type: () => StudentEntity,
  })
  student: StudentEntity;
}

export class PaginatedParentChildrenResponseDto {
  @ApiProperty({
    description: 'List of parent-child relationships',
    type: [ParentChildDto],
  })
  children: ParentChildDto[];

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
