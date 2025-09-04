import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'The email address to send the password reset link to',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The role of the user requesting password reset',
    enum: UserRole,
    example: UserRole.REGISTRAR,
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
} 