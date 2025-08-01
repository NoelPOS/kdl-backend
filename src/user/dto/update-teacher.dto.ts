import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTeacherDto {
  @ApiProperty({
    example: 'Teacher1',
    description: 'Teacher name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    example: 'teacher@gmail.com',
    description: 'Teacher email',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Teacher contact number',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactNo?: string;

  @ApiProperty({
    example: 'teacher_line_id',
    description: 'Teacher line ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  lineId?: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Teacher address',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Teacher profile picture',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({
    example: 'profile-key-123',
    description: 'Key for the teacher profile picture',
    required: false,
  })
  @IsString()
  @IsOptional()
  profileKey?: string;
}
