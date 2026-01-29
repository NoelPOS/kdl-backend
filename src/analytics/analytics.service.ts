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
import { DashboardOverviewDto, CourseTypeCountDto } from './dto/dashboard-overview.dto';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { Schedule } from '../schedule/entities/schedule.entity';

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
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
  ) {}

  async getDashboardOverview(filter?: AnalyticsFilterDto): Promise<DashboardOverviewDto> {
    // Execute all queries in parallel for better performance
    const [timeslotCount, scheduleCount, courseTypeCounts, activeStudentCount] = await Promise.all([
      this.getTimeslotCount(filter),
      this.getScheduleCount(filter),
      this.getCourseTypeCounts(filter),
      this.getActiveStudentCount(filter),
    ]);

    const distinctCourseCount = courseTypeCounts?.length ?? 0;

    return {
      timeslotCount,
      scheduleCount,
      activeStudentCount,
      distinctCourseCount,
      courseTypeCounts,
      // Legacy: when teacher is selected, teacherClassCount = timeslotCount for that teacher
      teacherClassCount: filter?.teacherId ? timeslotCount : undefined,
    };
  }

  /**
   * Count distinct timeslots (same date + startTime + endTime + room = one timeslot).
   * Used for Teacher View: one class with 3 students = 1 timeslot.
   */
  async getTimeslotCount(filter?: AnalyticsFilterDto): Promise<number> {
    const query = this.scheduleRepository
      .createQueryBuilder('schedule')
      .select(
        "COUNT(DISTINCT CONCAT(schedule.date, schedule.startTime, schedule.endTime, COALESCE(schedule.room, '')))",
        'count',
      );

    this.applyCommonFilters(query, filter);
    const result = await query.getRawOne();
    return parseInt(result?.count || '0');
  }

  /**
   * Count total schedule rows (each student enrollment = one schedule).
   * Used for Student View: one class with 3 students = 3 schedules.
   */
  async getScheduleCount(filter?: AnalyticsFilterDto): Promise<number> {
    const query = this.scheduleRepository
      .createQueryBuilder('schedule')
      .select('COUNT(schedule.id)', 'count');

    this.applyCommonFilters(query, filter);
    const result = await query.getRawOne();
    return parseInt(result?.count || '0');
  }

  private applyCommonFilters(
    query: ReturnType<Repository<Schedule>['createQueryBuilder']>,
    filter?: AnalyticsFilterDto,
  ): void {
    let hasWhere = false;
    if (filter?.startDate) {
      query.where('schedule.date >= :startDate', { startDate: filter.startDate });
      hasWhere = true;
    }
    if (filter?.endDate) {
      if (hasWhere) query.andWhere('schedule.date <= :endDate', { endDate: filter.endDate });
      else query.where('schedule.date <= :endDate', { endDate: filter.endDate });
      hasWhere = true;
    }
    if (filter?.teacherId) {
      if (hasWhere) query.andWhere('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
      else query.where('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
      hasWhere = true;
    }
    if (filter?.attendance) {
      if (hasWhere) query.andWhere('schedule.attendance = :attendance', { attendance: filter.attendance });
      else query.where('schedule.attendance = :attendance', { attendance: filter.attendance });
    }
  }

  async getCourseTypeCounts(filter?: AnalyticsFilterDto): Promise<CourseTypeCountDto[]> {
    const countBy = filter?.countBy || 'timeslot';
    const countClause =
      countBy === 'timeslot'
        ? "COUNT(DISTINCT CONCAT(schedule.date, schedule.startTime, schedule.endTime, COALESCE(schedule.room, '')))"
        : 'COUNT(schedule.id)';

    const query = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoin('schedule.course', 'course')
      .select('course.title', 'subject')
      .addSelect(countClause, 'count');

    // Apply date filters if provided
    let hasWhereClause = false;
    if (filter?.startDate) {
      query.where('schedule.date >= :startDate', { startDate: filter.startDate });
      hasWhereClause = true;
    }
    if (filter?.endDate) {
      if (hasWhereClause) {
        query.andWhere('schedule.date <= :endDate', { endDate: filter.endDate });
      } else {
        query.where('schedule.date <= :endDate', { endDate: filter.endDate });
        hasWhereClause = true;
      }
    }

    // Apply teacher filter if provided
    if (filter?.teacherId) {
      if (hasWhereClause) {
        query.andWhere('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
      } else {
        query.where('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
        hasWhereClause = true;
      }
    }

    // Apply attendance filter if provided
    if (filter?.attendance) {
      if (hasWhereClause) {
        query.andWhere('schedule.attendance = :attendance', { attendance: filter.attendance });
      } else {
        query.where('schedule.attendance = :attendance', { attendance: filter.attendance });
        hasWhereClause = true;
      }
    }

    const results = await query
      .groupBy('course.title')
      .getRawMany();

    return results.map(r => ({
      subject: r.subject || 'Unknown',
      count: parseInt(r.count || '0'),
    }));
  }

  async getActiveStudentCount(filter?: AnalyticsFilterDto): Promise<number> {
    const query = this.scheduleRepository
      .createQueryBuilder('schedule')
      .select('COUNT(DISTINCT schedule.studentId)', 'count');

    // Apply date filters if provided
    let hasWhereClause = false;
    if (filter?.startDate) {
      query.where('schedule.date >= :startDate', { startDate: filter.startDate });
      hasWhereClause = true;
    }
    if (filter?.endDate) {
      if (hasWhereClause) {
        query.andWhere('schedule.date <= :endDate', { endDate: filter.endDate });
      } else {
        query.where('schedule.date <= :endDate', { endDate: filter.endDate });
        hasWhereClause = true;
      }
    }

    // Apply teacher filter if provided
    if (filter?.teacherId) {
      if (hasWhereClause) {
        query.andWhere('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
      } else {
        query.where('schedule.teacherId = :teacherId', { teacherId: filter.teacherId });
        hasWhereClause = true;
      }
    }

    // Apply attendance filter if provided
    if (filter?.attendance) {
      if (hasWhereClause) {
        query.andWhere('schedule.attendance = :attendance', { attendance: filter.attendance });
      } else {
        query.where('schedule.attendance = :attendance', { attendance: filter.attendance });
        hasWhereClause = true;
      }
    }

    const result = await query.getRawOne();
    return parseInt(result?.count || '0');
  }
}
