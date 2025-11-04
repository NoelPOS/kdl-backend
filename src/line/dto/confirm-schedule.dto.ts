import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

/**
 * DTO for confirming schedule via LINE webhook
 */
export class ConfirmScheduleDto {
  @ApiProperty({
    description: 'LINE user ID',
    example: 'U1234567890abcdef',
  })
  @IsString()
  lineUserId: string;

  @ApiProperty({
    description: 'Schedule ID to confirm',
    example: 123,
  })
  @IsNumber()
  scheduleId: number;
}
