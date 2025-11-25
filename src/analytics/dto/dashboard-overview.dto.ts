import { ApiProperty } from '@nestjs/swagger';

export class CourseTypeCountDto {
  @ApiProperty({ description: 'Course subject/type' })
  subject: string;

  @ApiProperty({ description: 'Number of timeslots' })
  count: number;
}

export class DashboardOverviewDto {
  @ApiProperty({ description: 'Teacher class count (unique timeslots)', required: false })
  teacherClassCount?: number;

  @ApiProperty({ description: 'Course type counts', type: [CourseTypeCountDto], required: false })
  courseTypeCounts?: CourseTypeCountDto[];

  @ApiProperty({ description: 'Active student count in timeframe', required: false })
  activeStudentCount?: number;
}
