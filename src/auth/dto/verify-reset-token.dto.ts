import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class VerifyResetTokenDto {
  @ApiProperty({
    description: 'The verification token sent to the user email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The role of the user',
    enum: UserRole,
    example: UserRole.REGISTRAR,
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
