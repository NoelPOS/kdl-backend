import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';

export class ConnectParentStudentDto {
  @ApiProperty({ description: 'Parent ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  parentId: number;

  @ApiProperty({ description: 'Student ID', example: 2 })
  @IsNumber()
  @IsNotEmpty()
  studentId: number;

  @ApiProperty({
    description: 'Whether this parent is the primary contact for the student',
    example: true,
  })
  @IsBoolean()
  isPrimary: boolean;
}
