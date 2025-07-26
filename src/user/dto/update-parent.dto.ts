import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateParentDto {
  @ApiProperty({
    example: 'Parent1',
    description: 'Parent name',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    example: 'Parent@gmail.com',
    description: 'Parent email',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Parent contact number',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactNo?: string;

  @ApiProperty({
    example: 'Parent_line_id',
    description: 'Parent line ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  lineId?: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Parent address',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: 'https://example.com',
    description: 'Parent profile picture',
    required: false,
  })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({
    example: 'profile-key-123',
    description: 'Key for the parent profile picture',
    required: false,
  })
  @IsString()
  @IsOptional()
  profileKey?: string;
}
