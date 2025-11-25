import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray } from 'class-validator';

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

  @ApiProperty({
    description: 'Array of S3 URLs for feedback images',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  feedbackImages?: string[];

  @ApiProperty({
    description: 'Array of S3 URLs for feedback videos',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  feedbackVideos?: string[];
}
