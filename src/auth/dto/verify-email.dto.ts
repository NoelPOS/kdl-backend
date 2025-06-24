import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsDefined,
} from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'One-time verification code',
    example: '123456',
  })
  @IsString()
  @IsDefined({ message: 'OTP is required for email verification' })
  verificationCode: string;
}
