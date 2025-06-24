import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class AssignCoursesToTeacherDto {
  @ApiProperty({ example: [1, 2, 3], description: 'Array of course IDs' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  courseIds: number[];
}
