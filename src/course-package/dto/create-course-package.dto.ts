import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateCoursePackageDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Package name', example: 'Summer Special 5-Pack' })
  name: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ description: 'Number of classes in the package', example: 5 })
  numberOfCourses: number;
}
