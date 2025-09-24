import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { CreateRegistrarDto } from './create-registrar.dto';
import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateRegistrarDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Registrar name (will be mapped to userName)',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'registrar@example.com',
    description: 'Registrar email',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({
    example: 'https://kdl-image.s3.amazonaws.com/registrars/kdl_logo.jpg',
    description: 'Registrar profile picture URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({
    example: 'registrars/kdl_logo.jpg',
    description: 'Key for the registrar profile picture in S3',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileKey?: string;

  @ApiProperty({
    description: 'Registrar role',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role?: UserRole;
}