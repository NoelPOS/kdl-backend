import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Main Conference Room', description: 'Name of the room' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
