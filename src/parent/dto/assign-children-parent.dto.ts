import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayNotEmpty } from 'class-validator';

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
}
