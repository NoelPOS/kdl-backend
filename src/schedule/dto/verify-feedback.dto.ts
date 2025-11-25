import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class VerifyFeedbackDto {
  @ApiProperty({
    description:
      'Updated feedback content (admin/registrar can modify before verifying)',
    example: 'Student shows good progress in understanding concepts.',
  })
  @IsString()
  @IsNotEmpty()
  feedback: string;

  @ApiProperty({
    description:
      'Optional note from admin/registrar about the feedback verification',
    required: false,
    example: 'Feedback approved after minor corrections.',
  })
  @IsOptional()
  @IsString()
  verificationNote?: string;

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
