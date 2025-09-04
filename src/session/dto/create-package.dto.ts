import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class CreatePackageDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Course name for the package' })
  courseName: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Class option/mode for the package' })
  classOption: string;
}
