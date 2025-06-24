import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateScheduleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  attendance?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  verifyFb?: boolean;
}
