import { PartialType } from '@nestjs/swagger';
import { CreateSessionDto } from './create-session.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  classOptionId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  teacherId?: number;

  @ApiProperty({ required: false, description: 'Session status' })
  @IsOptional()
  @IsString()
  status?: string;
}
