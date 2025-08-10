import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AddCoursePlusDto {
  @ApiProperty()
  @IsNumber()
  sessionId: number;

  @ApiProperty()
  @IsNumber()
  additionalClasses: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timestamp?: string;
}
