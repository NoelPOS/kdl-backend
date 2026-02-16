import { IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateScheduleDto } from '../../schedule/dto/create-schedule.dto';
import { ApiProperty } from '@nestjs/swagger';

export class SwapSessionTypeDto {
  @ApiProperty()
  @IsNumber()
  classOptionId: number;

  @ApiProperty({ type: [CreateScheduleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleDto)
  newSchedules: CreateScheduleDto[];
}
