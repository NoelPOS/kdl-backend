import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Not, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Schedule } from '../../schedule/entities/schedule.entity';
import { ParentEntity } from '../../parent/entities/parent.entity';
import { ParentStudentEntity } from '../../parent/entities/parent-student.entity';
import { LineMessagingService } from './line-messaging.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { NotificationService } from '../../notification/notification.service';

/**
 * Schedule Notification Service
 * Handles sending schedule notifications to parents via LINE
 * 
 * Features:
 * - Daily cron job to send notifications 3 days in advance
 * - Validate parent ownership before allowing actions
 * - Confirm schedule attendance
 * - Request reschedule (creates replacement schedule)
 */
@Injectable()
export class ScheduleNotificationService {
  private readonly logger = new Logger(ScheduleNotificationService.name);

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(ParentEntity)
    private readonly parentRepository: Repository<ParentEntity>,
    @InjectRepository(ParentStudentEntity)
    private readonly parentStudentRepository: Repository<ParentStudentEntity>,
    private readonly lineMessagingService: LineMessagingService,
    private readonly scheduleService: ScheduleService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cron job: Send schedule notifications daily at 9:00 AM
   * Finds all schedules 3 days from now with 'pending' attendance
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyNotifications(): Promise<void> {
    // Default to 3 days from now for cron job
    await this.sendNotificationsForDaysOffset(3);
  }

  /**
   * Send notifications for schedules N days from now (or today if daysOffset is 0)
   * @param daysOffset Number of days from today (0 = today, 3 = 3 days from now)
   */
  async sendNotificationsForDaysOffset(daysOffset: number = 3): Promise<string> {
    this.logger.log(`Starting schedule notification job for ${daysOffset === 0 ? 'today' : `${daysOffset} days from now`}...`);

    try {
      // Calculate target date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysOffset);
      const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Find schedules for target date with pending attendance
      const schedules = await this.scheduleRepository.find({
        where: {
          date: dateString as any,
          attendance: 'pending',
        },
        relations: ['student', 'course', 'teacher', 'session'],
      });

      this.logger.log(`Found ${schedules.length} schedules to notify for date ${dateString}`);

      // Group schedules by student (to avoid duplicate messages to same parent)
      const schedulesByStudent = new Map<number, Schedule[]>();
      schedules.forEach((schedule) => {
        const studentId = schedule.studentId;
        if (!schedulesByStudent.has(studentId)) {
          schedulesByStudent.set(studentId, []);
        }
        schedulesByStudent.get(studentId).push(schedule);
      });

      // Send notifications to parents
      for (const [studentId, studentSchedules] of schedulesByStudent) {
        await this.notifyParentsForStudent(studentId, studentSchedules);
      }

      this.logger.log(`Notification job completed for date ${dateString}`);
      return dateString;
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Notify all parents of a student about their schedules
   */
  private async notifyParentsForStudent(
    studentId: number,
    schedules: Schedule[],
  ): Promise<void> {
    // Find all parents of this student
    const parentStudents = await this.parentStudentRepository.find({
      where: { studentId },
      relations: ['parent'],
    });

    for (const ps of parentStudents) {
      const parent = ps.parent;

      // Only send to verified parents (those with lineId)
      if (!parent.lineId) {
        this.logger.log(
          `Skipping parent ${parent.id} - no LINE ID linked`,
        );
        continue;
      }

      // Send notification for each schedule
      for (const schedule of schedules) {
        try {
          // Get attendance statistics for this student in this course
          const attendanceStats = await this.getAttendanceStats(
            schedule.studentId,
            schedule.courseId,
          );

          await this.lineMessagingService.sendScheduleNotification(
            parent.lineId,
            {
              scheduleId: schedule.id,
              studentName: schedule.student.name,
              studentImage: schedule.student.profilePicture,
              courseName: schedule.course.title,
              date: this.formatDate(schedule.date.toString()),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              room: schedule.room,
              teacherName: schedule.teacher?.name || 'TBD',
              attendedClasses: attendanceStats.attended,
              totalClasses: attendanceStats.total,
              cancelledClasses: attendanceStats.cancelled,
            },
          );

          this.logger.log(
            `Sent notification to parent ${parent.id} for schedule ${schedule.id}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to notify parent ${parent.id}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Get attendance statistics for a student in a course
   */
  private async getAttendanceStats(
    studentId: number,
    courseId: number,
  ): Promise<{ attended: number; total: number; cancelled: number }> {
    const allSchedules = await this.scheduleRepository.find({
      where: { studentId, courseId },
    });

    const attended = allSchedules.filter(
      (s) => s.attendance === 'present' || s.attendance === 'confirmed',
    ).length;
    const cancelled = allSchedules.filter(
      (s) => s.attendance === 'cancelled',
    ).length;
    const total = allSchedules.length;

    return { attended, total, cancelled };
  }

  /**
   * Validate that a parent owns the student of a schedule
   * Security check before allowing confirm/reschedule actions
   */
  async validateParentOwnership(
    lineUserId: string,
    scheduleId: number,
  ): Promise<boolean> {
    // Get parent by LINE user ID
    const parent = await this.parentRepository.findOne({
      where: { lineId: lineUserId },
    });

    if (!parent) {
      return false;
    }

    // Get schedule with student info
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return false;
    }

    // Check if parent has this student
    const parentStudent = await this.parentStudentRepository.findOne({
      where: {
        parentId: parent.id,
        studentId: schedule.studentId,
      },
    });

    return !!parentStudent;
  }

  /**
   * Confirm schedule attendance
   */
  async confirmSchedule(
    lineUserId: string,
    scheduleId: number,
  ): Promise<{
    studentName: string;
    date: string;
    startTime: string;
    room: string;
  }> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['student', 'teacher', 'course'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Check if already confirmed (Idempotency)
    if (schedule.attendance === 'confirmed') {
      this.logger.log(`Schedule ${scheduleId} is already confirmed. Skipping update.`);
      return {
        studentName: schedule.student.name,
        date: this.formatDate(schedule.date.toString()),
        startTime: schedule.startTime,
        room: schedule.room,
      };
    }

    // Update attendance to confirmed
    await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'confirmed',
      remark: 'Confirmed by parent via LINE',
    });

    // Notify Teacher
    if (schedule.teacherId) {
      await this.notificationService.create(
        schedule.teacherId,
        'Schedule Confirmed',
        `${schedule.student.name} confirmed attendance for ${schedule.course.title} on ${this.formatDate(schedule.date.toString())} at ${schedule.startTime}.`,
        'schedule_confirmed',
        { 
          scheduleId,
          studentId: schedule.studentId,
          sessionId: schedule.sessionId 
        },
      );
    }

    // Notify Registrar and Admin
    const rolesToNotify = ['registrar', 'admin'];
    for (const role of rolesToNotify) {
      await this.notificationService.createForRole(
        role,
        'Schedule Confirmed',
        `${schedule.student.name} confirmed attendance for ${schedule.course.title} on ${this.formatDate(schedule.date.toString())} at ${schedule.startTime}.`,
        'schedule_confirmed',
        { 
          scheduleId,
          studentId: schedule.studentId,
          sessionId: schedule.sessionId 
        },
      );
    }

    this.logger.log(
      `Schedule ${scheduleId} confirmed by LINE user ${lineUserId}`,
    );

    return {
      studentName: schedule.student.name,
      date: this.formatDate(schedule.date.toString()),
      startTime: schedule.startTime,
      room: schedule.room,
    };
  }

  /**
   * Request reschedule (marks as cancelled, creates replacement)
   */
  async requestReschedule(
    lineUserId: string,
    scheduleId: number,
  ): Promise<{
    studentName: string;
    date: string;
  }> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['student', 'teacher', 'course'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Check if already cancelled (Idempotency)
    if (schedule.attendance === 'cancelled') {
      this.logger.log(`Schedule ${scheduleId} is already cancelled. Skipping update.`);
      return {
        studentName: schedule.student.name,
        date: this.formatDate(schedule.date.toString()),
      };
    }

    // Check if already confirmed or present
    if (schedule.attendance === 'confirmed' || schedule.attendance === 'present') {
      throw new BadRequestException('Class is already confirmed. Please contact admin to reschedule.');
    }

    // Mark as cancelled with reschedule request
    await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'cancelled',
      remark: 'Reschedule requested by parent via LINE',
    });

    // 1. Notify Registrar and Admin (to re-book)
    const rolesToNotify = ['registrar', 'admin'];
    for (const role of rolesToNotify) {
      await this.notificationService.createForRole(
        role,
        'Reschedule Requested',
        `Parent of ${schedule.student.name} requested to reschedule ${schedule.course.title} on ${this.formatDate(schedule.date.toString())}.`,
        'schedule_cancelled',
        { 
          scheduleId, 
          studentId: schedule.studentId,
          sessionId: schedule.sessionId,
          oldDate: schedule.date, 
          oldTime: schedule.startTime 
        },
      );
    }

    // 2. Notify Teacher (Cancellation)
    if (schedule.teacherId) {
      await this.notificationService.create(
        schedule.teacherId,
        'Class Cancelled',
        `Class with ${schedule.student.name} (${schedule.course.title}) on ${this.formatDate(schedule.date.toString())} has been cancelled by parent.`,
        'schedule_cancelled',
        { 
          scheduleId,
          studentId: schedule.studentId,
          sessionId: schedule.sessionId
        },
      );
    }

    this.logger.log(
      `Reschedule requested for schedule ${scheduleId} by LINE user ${lineUserId}`,
    );

    return {
      studentName: schedule.student.name,
      date: this.formatDate(schedule.date.toString()),
    };
  }

  /**
   * Format date to readable string
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Manual trigger for testing (can be called via admin endpoint)
   */
  async sendTestNotification(parentId: number, scheduleId: number): Promise<void> {
    const parent = await this.parentRepository.findOne({
      where: { id: parentId },
    });

    if (!parent || !parent.lineId) {
      throw new NotFoundException('Parent not found or LINE not linked');
    }

    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
      relations: ['student', 'course', 'teacher'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Get attendance statistics
    const attendanceStats = await this.getAttendanceStats(
      schedule.studentId,
      schedule.courseId,
    );

    await this.lineMessagingService.sendScheduleNotification(parent.lineId, {
      scheduleId: schedule.id,
      studentName: schedule.student.name,
      studentImage: schedule.student.profilePicture,
      courseName: schedule.course.title,
      date: this.formatDate(schedule.date.toString()),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
      teacherName: schedule.teacher?.name || 'TBD',
      attendedClasses: attendanceStats.attended,
      totalClasses: attendanceStats.total,
      cancelledClasses: attendanceStats.cancelled,
    });

    this.logger.log(`Test notification sent to parent ${parentId}`);
  }
}
