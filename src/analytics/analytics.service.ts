import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { CourseEntity } from '../course/entities/course.entity';
import { Session } from '../session/entities/session.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Receipt } from '../receipt/entities/receipt.entity';
import { StudentEntity } from '../student/entities/student.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { DashboardOverviewDto, TotalCountsDto, RevenueMetricsDto, TopCourseDto } from './dto/dashboard-overview.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepository: Repository<TeacherEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  async getDashboardOverview(): Promise<DashboardOverviewDto> {
    // Execute all queries in parallel for better performance
    const [totalCounts, revenue, topCourses] = await Promise.all([
      this.getTotalCounts(),
      this.getRevenueMetrics(),
      this.getTopCourses(),
    ]);

    return {
      totalCounts,
      revenue,
      topCourses,
    };
  }

  async getTotalCounts(): Promise<TotalCountsDto> {
    // Use Promise.all to execute count queries in parallel
    const [students, teachers, courses, activeSessions] = await Promise.all([
      this.studentRepository.count(),
      this.teacherRepository.count(),
      this.courseRepository.count(),
      this.sessionRepository.count({
        where: { status: 'wip' }, // Count sessions that are "work in progress" (active)
      }),
    ]);

    return {
      students,
      teachers,
      courses,
      activeSessions,
    };
  }

  async getRevenueMetrics(): Promise<RevenueMetricsDto> {
    // Get current and previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Execute revenue queries in parallel - using invoices instead of receipts
    const [totalRevenueResult, currentMonthResult, previousMonthResult] = await Promise.all([
      // Total revenue from invoices
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(invoice.totalAmount)', 'total')
        .getRawOne(),

      // Current month revenue
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(invoice.totalAmount)', 'total')
        .where('invoice.createdAt >= :start', { start: currentMonthStart })
        .getRawOne(),

      // Previous month revenue
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(invoice.totalAmount)', 'total')
        .where('invoice.createdAt >= :start AND invoice.createdAt <= :end', {
          start: previousMonthStart,
          end: previousMonthEnd,
        })
        .getRawOne(),
    ]);

    const totalRevenue = parseFloat(totalRevenueResult?.total || '0');
    const currentMonthRevenue = parseFloat(currentMonthResult?.total || '0');
    const previousMonthRevenue = parseFloat(previousMonthResult?.total || '0');

    // Calculate growth percentage
    let revenueGrowth = 0;
    if (previousMonthRevenue > 0) {
      revenueGrowth = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
      revenueGrowth = 100; // 100% growth if previous month was 0
    }

    return {
      totalRevenue,
      currentMonthRevenue,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100, // Round to 2 decimal places
    };
  }

  async getTopCourses(): Promise<TopCourseDto[]> {
    // Get top courses by enrollment count, excluding TBC courses
    const topCoursesByEnrollment = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.course', 'course')
      .select([
        'course.title as title',
        'COUNT(DISTINCT session.id) as enrollmentCount'
      ])
      .where('course.title NOT ILIKE :tbcPattern', { tbcPattern: '%TBC%' })
      .andWhere('(session.packageGroupId IS NULL OR session.packageGroupId = session.id)') // Exclude TBC sessions that are part of packages
      .groupBy('course.id, course.title')
      .orderBy('enrollmentCount', 'DESC')
      .limit(3)
      .getRawMany();

    return topCoursesByEnrollment.map(course => ({
      id: parseInt(course.id),
      title: course.title || 'Unknown Course',
      enrollmentCount: parseInt(course.enrollmentcount || '0'),
    }));
  }
}
