import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class RegistrarResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: number;

  @ApiProperty({ description: 'Registrar name' })
  name: string;

  @ApiProperty({ description: 'Registrar email' })
  email: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  // Add profilePicture and profileKey as empty strings to match your frontend type
  @ApiProperty({ description: 'Profile picture URL', default: '' })
  profilePicture: string;

  @ApiProperty({ description: 'Profile picture key', default: '' })
  profileKey: string;
}
