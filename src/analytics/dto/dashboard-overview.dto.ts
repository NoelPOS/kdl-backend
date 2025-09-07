import { ApiProperty } from '@nestjs/swagger';

export class TotalCountsDto {
  @ApiProperty({ description: 'Total number of students' })
  students: number;

  @ApiProperty({ description: 'Total number of teachers' })
  teachers: number;

  @ApiProperty({ description: 'Total number of courses' })
  courses: number;

  @ApiProperty({ description: 'Total number of active sessions' })
  activeSessions: number;
}

export class RevenueMetricsDto {
  @ApiProperty({ description: 'Total revenue all time' })
  totalRevenue: number;

  @ApiProperty({ description: 'Current month revenue' })
  currentMonthRevenue: number;

  @ApiProperty({ description: 'Revenue growth percentage (month-over-month)' })
  revenueGrowth: number;
}

export class TopCourseDto {
  @ApiProperty({ description: 'Course ID' })
  id: number;

  @ApiProperty({ description: 'Course title' })
  title: string;

  @ApiProperty({ description: 'Number of enrollments' })
  enrollmentCount: number;
}

export class DashboardOverviewDto {
  @ApiProperty({ description: 'Total counts overview', type: TotalCountsDto })
  totalCounts: TotalCountsDto;

  @ApiProperty({ description: 'Revenue metrics', type: RevenueMetricsDto })
  revenue: RevenueMetricsDto;

  @ApiProperty({ description: 'Top 5 best selling courses', type: [TopCourseDto] })
  topCourses: TopCourseDto[];
}
