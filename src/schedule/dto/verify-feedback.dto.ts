import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
