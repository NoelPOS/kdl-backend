import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class CreatePackageDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ description: 'Student ID' })
  studentId: number;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty({ description: 'Course package template ID from course_packages table' })
  packageId: number;
}
