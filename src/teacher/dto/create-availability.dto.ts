import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Day of week (Monday, Tuesday, etc.)',
    example: 'Monday',
  })
  dayOfWeek: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm format' })
  @ApiProperty({ description: 'Start time (HH:mm)', example: '10:00' })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:mm format' })
  @ApiProperty({ description: 'End time (HH:mm)', example: '14:00' })
  endTime: string;
}
