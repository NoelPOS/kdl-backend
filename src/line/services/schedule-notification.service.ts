import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Not, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Schedule } from '../../schedule/entities/schedule.entity';
import { ParentEntity } from '../../parent/entities/parent.entity';
import { ParentStudentEntity } from '../../parent/entities/parent-student.entity';
import { LineMessagingService } from './line-messaging.service';
import { ScheduleService } from '../../schedule/schedule.service';

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
  ) {}

  /**
   * Cron job: Send schedule notifications daily at 9:00 AM
   * Finds all schedules 3 days from now with 'pending' attendance
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyNotifications(): Promise<void> {
    this.logger.log('Starting daily schedule notification job...');

    try {
      // Calculate date 3 days from now
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);
      const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Find schedules for 3 days from now with pending attendance
      const schedules = await this.scheduleRepository.find({
        where: {
          date: dateString as any,
          attendance: 'pending',
        },
        relations: ['student', 'course', 'teacher', 'session'],
      });

      this.logger.log(`Found ${schedules.length} schedules to notify`);

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

      this.logger.log('Daily notification job completed');
    } catch (error) {
      this.logger.error(`Failed to send daily notifications: ${error.message}`, error.stack);
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
          await this.lineMessagingService.sendScheduleNotification(
            parent.lineId,
            {
              scheduleId: schedule.id,
              studentName: schedule.student.name,
              courseName: schedule.course.title,
              date: this.formatDate(schedule.date.toString()),
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              room: schedule.room,
              teacherName: schedule.teacher?.name || 'TBD',
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
      relations: ['student'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Update attendance to confirmed
    await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'confirmed',
      remark: 'Confirmed by parent via LINE',
    });

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
      relations: ['student'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Mark as cancelled with reschedule request
    await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'cancelled',
      remark: 'Reschedule requested by parent via LINE',
    });

    // The updateSchedule method already creates a replacement schedule
    // when attendance is changed to 'cancelled'

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

    await this.lineMessagingService.sendScheduleNotification(parent.lineId, {
      scheduleId: schedule.id,
      studentName: schedule.student.name,
      courseName: schedule.course.title,
      date: this.formatDate(schedule.date.toString()),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
      teacherName: schedule.teacher?.name || 'TBD',
    });

    this.logger.log(`Test notification sent to parent ${parentId}`);
  }
}
