import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDefined,
} from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsDefined({ message: 'OTP is required for email verification' })
  verificationCode: string;
}
