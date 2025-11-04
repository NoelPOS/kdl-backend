import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for verifying parent identity and linking LINE user ID
 * Parent must provide either email OR phone number that matches database record
 */
export class VerifyParentDto {
  @ApiProperty({
    description: 'LINE user ID from LIFF SDK',
    example: 'U1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  lineUserId: string;

  @ApiProperty({
    description: 'Parent email address (optional if phone is provided)',
    example: 'parent@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Parent contact number (optional if email is provided)',
    example: '0812345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  contactNo?: string;
}
