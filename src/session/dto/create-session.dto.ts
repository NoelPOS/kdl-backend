import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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
