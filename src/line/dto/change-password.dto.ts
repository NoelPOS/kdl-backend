import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description:
      'Current password for verification (or phone number if first time)',
    example: '123456',
  })
  @IsString()
  currentPassword?: string;

  @ApiProperty({
    description: 'New password',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;

  @ApiProperty({
    description: 'LINE user ID to identify the parent',
    example: 'U123456...',
  })
  @IsString()
  lineUserId: string;
}
