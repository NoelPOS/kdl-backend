import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkflowStatusDto {
  @IsString()
  @IsIn(['incoming', 'wip', 'resolved', 'ignored'])
  @ApiProperty({ enum: ['incoming', 'wip', 'resolved', 'ignored'] })
  workflowStatus: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Employee name handling this (required when wip)',
  })
  wipBy?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Note or remark about this notification',
  })
  remark?: string;
}
