import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CheckScheduleConflictDto } from './check-schedule-conflict.dto';

export class CheckConflictBatchDto {
  @ApiProperty({ type: [CheckScheduleConflictDto] })
  @ValidateNested({ each: true })
  @Type(() => CheckScheduleConflictDto)
  schedules: CheckScheduleConflictDto[];
}
