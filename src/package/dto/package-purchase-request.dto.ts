import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PackagePurchaseRequestDto {
  @ApiProperty({ description: 'Student ID' })
  @IsNotEmpty()
  @IsNumber()
  studentId: number;

  @ApiProperty({ description: 'Student name' })
  @IsNotEmpty()
  @IsString()
  studentName: string;

  @ApiProperty({ description: 'Class option ID' })
  @IsNotEmpty()
  @IsNumber()
  classOptionId: number;

  @ApiProperty({ description: 'Class option title' })
  @IsNotEmpty()
  @IsString()
  classOptionTitle: string;

  @ApiProperty({ description: 'Class mode' })
  @IsNotEmpty()
  @IsString()
  classMode: string;

  @ApiProperty({ description: 'Tuition fee' })
  @IsNotEmpty()
  @IsNumber()
  tuitionFee: number;

  @ApiProperty({ description: 'Class limit' })
  @IsNotEmpty()
  @IsNumber()
  classLimit: number;
}
