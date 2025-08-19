import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayNotEmpty, IsBoolean } from 'class-validator';

export class AssignChildrenToParentDto {
  @ApiProperty({
    description: 'Array of student IDs to assign as children',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  studentIds: number[];

  @ApiProperty({
    description: 'Indicates if the parent is the primary guardian',
    example: true,
  })
  @IsBoolean()
  isPrimary: boolean;
}
