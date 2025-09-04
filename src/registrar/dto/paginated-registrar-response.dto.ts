import { ApiProperty } from '@nestjs/swagger';
import { RegistrarResponseDto } from './registrar-response.dto';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  currentPage: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Total count of items' })
  totalCount: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}

export class PaginatedRegistrarResponseDto {
  @ApiProperty({
    description: 'Array of registrars',
    type: [RegistrarResponseDto],
  })
  registrars: RegistrarResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;
}
