import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  studentId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  courseId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  mode: string;

  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  classLimit: number;

  @ApiProperty()
  @IsInt()
  @Type(() => Number)
  classCancel: number;

  @ApiProperty()
  @IsString()
  payment: string;

  @ApiProperty()
  @IsString()
  status: string;
}
