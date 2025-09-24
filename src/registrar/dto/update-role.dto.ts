import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'New role for the user',
    enum: UserRole,
    example: 'none',
  })
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role: UserRole;
}