import { ApiProperty } from '@nestjs/swagger';

export class CourseTypeCountDto {
  @ApiProperty({ description: 'Course subject/type' })
  subject: string;

  @ApiProperty({ description: 'Count (timeslots in Teacher View, schedules in Student View)' })
  count: number;
}

export class DashboardOverviewDto {
  @ApiProperty({ description: 'Distinct timeslots (date+time+room). Used in Teacher View.' })
  timeslotCount: number;

  @ApiProperty({ description: 'Total schedule rows (each enrollment). Used in Student View.' })
  scheduleCount: number;

  @ApiProperty({ description: 'Distinct students in filtered period' })
  activeStudentCount: number;

  @ApiProperty({ description: 'Number of distinct courses' })
  distinctCourseCount: number;

  @ApiProperty({ description: 'Per-course counts (timeslot or schedule depending on countBy)', type: [CourseTypeCountDto] })
  courseTypeCounts: CourseTypeCountDto[];

  @ApiProperty({ description: 'When teacher filter applied: same as timeslotCount for that teacher', required: false })
  teacherClassCount?: number;
}
