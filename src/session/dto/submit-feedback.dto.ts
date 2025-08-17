import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class SubmitFeedbackDto {
  @ApiProperty({ description: 'Session ID' })
  @IsNumber()
  @IsNotEmpty()
  sessionId: number;

  @ApiProperty({ description: 'Student ID' })
  @IsNumber()
  @IsNotEmpty()
  studentId: number;

  @ApiProperty({ description: 'Teacher feedback' })
  @IsString()
  @IsNotEmpty()
  feedback: string;

  @ApiProperty({
    description: 'Timestamp when feedback was submitted',
    required: false,
  })
  @IsOptional()
  @IsString()
  timestamp?: string;
}
