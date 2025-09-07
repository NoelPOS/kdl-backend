import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { DashboardOverviewDto, TotalCountsDto, RevenueMetricsDto, TopCourseDto } from './dto/dashboard-overview.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
@ApiTags('Analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview with all key metrics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard overview data',
    type: DashboardOverviewDto,
  })
  async getDashboardOverview(): Promise<DashboardOverviewDto> {
    return this.analyticsService.getDashboardOverview();
  }

  @Get('total-counts')
  @ApiOperation({ summary: 'Get total counts of students, teachers, courses, and active sessions' })
  @ApiResponse({
    status: 200,
    description: 'Total counts data',
    type: TotalCountsDto,
  })
  async getTotalCounts(): Promise<TotalCountsDto> {
    return this.analyticsService.getTotalCounts();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue metrics including total, current month, and growth' })
  @ApiResponse({
    status: 200,
    description: 'Revenue metrics data',
    type: RevenueMetricsDto,
  })
  async getRevenueMetrics(): Promise<RevenueMetricsDto> {
    return this.analyticsService.getRevenueMetrics();
  }

  @Get('top-courses')
  @ApiOperation({ summary: 'Get top 5 best selling courses by enrollment and revenue' })
  @ApiResponse({
    status: 200,
    description: 'Top courses data',
    type: [TopCourseDto],
  })
  async getTopCourses(): Promise<TopCourseDto[]> {
    return this.analyticsService.getTopCourses();
  }
}
