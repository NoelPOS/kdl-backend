import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  courseId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  classOptionId: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  teacherId: number;

  @ApiProperty()
  @IsNumber()
  classCancel: number;

  @ApiProperty()
  @IsString()
  payment: string;

  @ApiProperty()
  @IsString()
  status: string;
}
