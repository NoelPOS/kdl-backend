import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { VerifyFeedbackDto } from './dto/verify-feedback.dto';
import { FeedbackFilterDto } from './dto/feedback-filter.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { TeacherEntity } from '../teacher/entities/teacher.entity';
import { CheckScheduleConflictDto } from './dto/check-schedule-conflict.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { time } from 'console';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  async create(dto: CreateScheduleDto) {
    const schedule = this.scheduleRepo.create(dto);
    return await this.scheduleRepo.save(schedule);
  }

  async createBulkSchedules(dtos: CreateScheduleDto[]) {
    const schedules = dtos.map((dto) => this.scheduleRepo.create(dto));
    return await this.scheduleRepo.save(schedules);
  }

  async findOne(id: number) {
    return this.scheduleRepo.findOne({ 
      where: { id },
      relations: ['student', 'teacher', 'course', 'session', 'session.classOption']
    });
  }

  async updateSchedule(
    id: number,
    dto: UpdateScheduleDto,
    user?: any,
  ) {

    console.log("This is the update schedule dto: ", dto);
    console.log("DTO feedbackImages:", dto.feedbackImages);
    console.log("DTO feedbackVideos:", dto.feedbackVideos);
    
    // First, get the current schedule to check permissions
    const existingSchedule = await this.scheduleRepo.findOne({ where: { id } });
    if (!existingSchedule) {
      throw new BadRequestException(`Schedule with ID ${id} not found`);
    }

    const prevAttendance = existingSchedule.attendance;

    // Validate teacherId if provided
    if (dto.teacherId !== undefined && dto.teacherId !== null) {
      const teacherExists = await this.teacherRepo.findOne({
        where: { id: dto.teacherId }
      });
      if (!teacherExists) {
        throw new BadRequestException(`Teacher with ID ${dto.teacherId} not found. For free trials without a teacher, use null.`);
      }
    }

    // Only pick fields that exist in the Schedule entity
    const updateFields: any = {};
    if (dto.date !== undefined) updateFields.date = dto.date;
    if (dto.startTime !== undefined) updateFields.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateFields.endTime = dto.endTime;
    if (dto.room !== undefined) updateFields.room = dto.room;
    if (dto.remark !== undefined) updateFields.remark = dto.remark;
    if (dto.attendance !== undefined) updateFields.attendance = dto.attendance;
    if (dto.teacherId !== undefined) updateFields.teacherId = dto.teacherId;
    if (dto.courseId !== undefined) updateFields.courseId = dto.courseId;
    if (dto.warning !== undefined) updateFields.warning = dto.warning;

    // Handle feedback updates with role-based permissions
    if (dto.feedback !== undefined) {
      if (user && user.role === 'teacher') {
        // Teachers can only update feedback for their own schedules
        if (existingSchedule.teacherId !== user.id) {
          throw new BadRequestException(
            'Teachers can only update feedback for their own schedules',
          );
        }
        updateFields.feedback = dto.feedback;
        // When teacher updates feedback, reset verification status and set feedback date
        updateFields.verifyFb = false;
        updateFields.feedbackDate = dto.feedbackDate
          ? new Date(dto.feedbackDate)
          : new Date();
        // Add media fields for teachers (empty arrays clear the field)
        if (dto.feedbackImages !== undefined) {
          updateFields.feedbackImages = dto.feedbackImages.length > 0 ? dto.feedbackImages : null;
        }
        if (dto.feedbackVideos !== undefined) {
          updateFields.feedbackVideos = dto.feedbackVideos.length > 0 ? dto.feedbackVideos : null;
        }
        // Don't set modified fields for original teacher
      } else if (user && (user.role === 'admin' || user.role === 'registrar')) {
        // Admin/Registrar can update any feedback
        updateFields.feedback = dto.feedback;
        updateFields.feedbackModifiedByName = user.name || user.userName;
        updateFields.feedbackModifiedAt = new Date();
        
        // Add media fields for admin/registrar (empty arrays clear the field)
        if (dto.feedbackImages !== undefined) {
          updateFields.feedbackImages = dto.feedbackImages.length > 0 ? dto.feedbackImages : null;
        }
        if (dto.feedbackVideos !== undefined) {
          updateFields.feedbackVideos = dto.feedbackVideos.length > 0 ? dto.feedbackVideos : null;
        }
        
        if (dto.feedbackDate) {
          updateFields.feedbackDate = new Date(dto.feedbackDate);
        }
        if (dto.verifyFb !== undefined) {
          updateFields.verifyFb = dto.verifyFb;
        }
      } else {
        updateFields.feedback = dto.feedback;
        // Add media fields for other users (empty arrays clear the field)
        if (dto.feedbackImages !== undefined) {
          updateFields.feedbackImages = dto.feedbackImages.length > 0 ? dto.feedbackImages : null;
        }
        if (dto.feedbackVideos !== undefined) {
          updateFields.feedbackVideos = dto.feedbackVideos.length > 0 ? dto.feedbackVideos : null;
        }
        
        if (dto.feedbackDate) {
          updateFields.feedbackDate = new Date(dto.feedbackDate);
        }
        if (dto.verifyFb !== undefined) {
          updateFields.verifyFb = dto.verifyFb;
        }
      }
    }

    // Handle verifyFb separately if provided without feedback
    if (dto.verifyFb !== undefined && dto.feedback === undefined) {
      if (user && user.role === 'teacher') {
        throw new BadRequestException(
          'Teachers cannot verify their own feedback',
        );
      }
      updateFields.verifyFb = dto.verifyFb;
    }

    // Check if attendance is being changed to 'cancelled'
    const isBeingCancelled = dto.attendance === 'cancelled' && prevAttendance !== 'cancelled';

    const result = await this.scheduleRepo.update(id, updateFields);
    if (result.affected === 0) {
      return null; // Schedule not found
    }

    // If schedule is being cancelled, create a replacement schedule with default values
    if (isBeingCancelled) {
      await this.createReplacementSchedule(existingSchedule);
    }

    // Only revalidate warnings if the schedule has a valid date
    if (existingSchedule.date) {
      await this.revalidateWarningsAfterCancellation(existingSchedule);
    }

    return this.scheduleRepo.findOne({ where: { id } });
  }

  private async createReplacementSchedule(cancelledSchedule: any) {
    try {
      // Create a new schedule with default values for the same session
      const replacementSchedule = this.scheduleRepo.create({
        sessionId: cancelledSchedule.sessionId,
        courseId: cancelledSchedule.courseId,
        studentId: cancelledSchedule.studentId,
        teacherId: null, // Default to null
        date: null, // Default to null
        startTime: 'TBD', // Default value
        endTime: 'TBD', // Default value
        room: 'TBD', // Default value
        attendance: 'pending', // Default value
        remark: '', // Default value
        feedback: '', // Default to empty string
        verifyFb: false, // Default value
        classNumber: cancelledSchedule.classNumber, // Keep the same class number
        warning: "", // Default to empty string
      });

      await this.scheduleRepo.save(replacementSchedule);
      console.log(`Created replacement schedule for cancelled schedule ID: ${cancelledSchedule.id}`);
    } catch (error) {
      console.error('Error creating replacement schedule:', error);
      // Don't throw error to prevent blocking the main update operation
    }
  }

  private generateConflictWarning = (conflict: any) => {
    const { conflictType, courseTitle, teacherName, studentName, room, time } =
      conflict;

    switch (conflictType) {
      case 'room':
        return `${room} is not available. There is a ${courseTitle} class at ${time}.`;
      case 'teacher':
        return `Teacher ${teacherName} is not available. Teacher ${teacherName} is teaching ${courseTitle} at ${time}.`;
      case 'student':
        return `Student ${studentName} is not available. Student ${studentName} is learning ${courseTitle} at ${time}.`;
      case 'room_teacher':
        return `${room} is not available. Teacher ${teacherName} is teaching ${courseTitle} at ${time}.`;
      case 'room_student':
        return `${room} is not available. Student ${studentName} is learning ${courseTitle} at ${time}.`;
      case 'teacher_student':
        return `Teacher ${teacherName} is not available. Student ${studentName} is learning ${courseTitle} at ${time}.`;
      case 'all':
        return `Room ${room} is not available. Teacher ${teacherName} is teaching ${courseTitle} at ${time}. Student ${studentName} is learning ${courseTitle} at ${time}.`;
      default:
        return `Conflict with ${courseTitle}`;
    }
  };

  private async revalidateWarningsAfterCancellation(
    cancelledSchedule: Schedule,
  ) {
    // Skip if cancelled schedule doesn't have a date
    if (!cancelledSchedule.date) {
      return;
    }

    // Find schedules on the same date that might have conflicted
    const potentiallyConflicted = await this.scheduleRepo.find({
      where: { date: cancelledSchedule.date },
    });

    for (const schedule of potentiallyConflicted) {
      // Skip schedules with null date, startTime, endTime, or room
      if (!schedule.date || !schedule.startTime || !schedule.endTime || !schedule.room) {
        continue;
      }

      const conflict = await this.checkConflict({
        date: schedule.date.toString(),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        teacherId: schedule.teacherId,
        studentId: schedule.studentId,
        excludeId: schedule.id,
      });

      if (!conflict) {
        // No more conflicts → clear warning
        await this.scheduleRepo.update(schedule.id, { warning: '' });
      } else {
        // Still conflicting → update warning text if needed
        await this.scheduleRepo.update(schedule.id, {
          warning: this.generateConflictWarning(conflict),
        });
      }
    }
  }

  async verifyFeedback(id: number, dto: VerifyFeedbackDto, user: any) {
    // First, get the current schedule
    const existingSchedule = await this.scheduleRepo.findOne({
      where: { id },
      relations: ['student', 'teacher', 'course'],
    });

    if (!existingSchedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    // Only admin and registrar can verify feedback
    if (user.role !== 'admin' && user.role !== 'registrar') {
      throw new BadRequestException(
        'Only admin and registrar can verify feedback',
      );
    }

    // Prepare update fields
    const updateFields: any = {
      feedback: dto.feedback,
      verifyFb: true,
      feedbackDate: new Date(),
      feedbackModifiedByName: user.name || user.userName,
      feedbackModifiedAt: new Date(),
    };

    // Add media arrays if provided (empty arrays clear the field)
    if (dto.feedbackImages !== undefined) {
      updateFields.feedbackImages = dto.feedbackImages.length > 0 ? dto.feedbackImages : null;
    }
    if (dto.feedbackVideos !== undefined) {
      updateFields.feedbackVideos = dto.feedbackVideos.length > 0 ? dto.feedbackVideos : null;
    }

    const result = await this.scheduleRepo.update(id, updateFields);

    if (result.affected === 0) {
      throw new NotFoundException(`Failed to update schedule with ID ${id}`);
    }

    return {
      success: true,
      message: 'Feedback has been verified and updated successfully',
      scheduleId: id,
      updatedFeedback: dto.feedback,
      verifiedBy: user.role,
      verifiedAt: new Date().toISOString(),
      verificationNote: dto.verificationNote || null,
      mediaAttached: {
        images: dto.feedbackImages?.length || 0,
        videos: dto.feedbackVideos?.length || 0,
      },
      scheduleDetails: {
        studentName: existingSchedule.student?.name,
        teacherName: existingSchedule.teacher?.name,
        courseName: existingSchedule.course?.title,
        date: existingSchedule.date,
      },
    };
  }

  async getSchedulesWithPendingFeedback(page: number = 1, limit: number = 10) {
    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);

    // Get schedules that have feedback but are not verified
    const queryBuilder = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .leftJoinAndSelect('schedule.session', 'session')
      .where('schedule.feedback IS NOT NULL')
      .andWhere('schedule.feedback != :emptyFeedback', { emptyFeedback: '' })
      .andWhere('schedule.verifyFb = :verifyFb', { verifyFb: false })
      .orderBy('schedule.createdAt', 'DESC');

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (validatedPage - 1) * validatedLimit;
    const schedules = await queryBuilder
      .skip(offset)
      .take(validatedLimit)
      .getMany();

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNext = validatedPage < totalPages;
    const hasPrev = validatedPage > 1;

    return {
      schedules,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getFilteredFeedbacks(filterDto: FeedbackFilterDto) {
    const {
      studentName,
      courseName,
      teacherName,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 10,
    } = filterDto;

    console.log('Filter DTO received:', filterDto);

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);

    // Build query for schedules with unverified feedback
    // Note: status='all' or undefined both fetch unverified feedbacks (verifyFb = false)
    const queryBuilder = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .leftJoinAndSelect('schedule.session', 'session')
      .where('schedule.feedback IS NOT NULL')
      .andWhere('schedule.feedback != :emptyFeedback', { emptyFeedback: '' })
      .andWhere('schedule.verifyFb = :verifyFb', { verifyFb: false }) // Always fetch unverified feedbacks
      .orderBy('schedule.feedbackDate', 'DESC');


    // Apply filters
    if (studentName) {
      queryBuilder.andWhere('student.name ILIKE :studentName', {
        studentName: `%${studentName}%`,
      });
    }

    if (courseName) {
      queryBuilder.andWhere('course.title ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
    }

    if (teacherName) {
      queryBuilder.andWhere('teacher.name ILIKE :teacherName', {
        teacherName: `%${teacherName}%`,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('schedule.feedbackDate >= :startDate', {
        startDate: new Date(startDate).toISOString(),
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // include the entire day
      queryBuilder.andWhere('schedule.feedbackDate <= :endDate', {
        endDate: end.toISOString(),
      });
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (validatedPage - 1) * validatedLimit;
    const schedules = await queryBuilder
      .skip(offset)
      .take(validatedLimit)
      .getMany();

    // Transform the data to match the frontend FeedbackItem interface
    const feedbacks = schedules.map((schedule) => {
      console.log('Raw schedule data:', {
        feedbackImages: schedule.feedbackImages,
        feedbackVideos: schedule.feedbackVideos,
        feedbackImagesType: typeof schedule.feedbackImages,
        feedbackVideosType: typeof schedule.feedbackVideos,
      });
      
      return {
        id: schedule.id.toString(),
        scheduleId: schedule.id.toString(),
        studentId: schedule.student?.id?.toString() || '',
        studentName: schedule.student?.name || '',
        studentNickname: schedule.student?.nickname || '',
        studentPhone: schedule.student?.phone || '',
        studentProfilePicture: schedule.student?.profilePicture || '',
        courseTitle: schedule.course?.title || '',
        teacherName: schedule.teacher?.name || '',
        feedback: schedule.feedback || '',
        feedbackDate: schedule.feedbackDate
          ? schedule.feedbackDate.toISOString()
          : '',
        sessionDate: schedule.date ? schedule.date.toString() : '',
        sessionTime:
          schedule.startTime && schedule.endTime
            ? `${schedule.startTime} - ${schedule.endTime}`
            : '',
        // Add modification tracking fields
        feedbackModifiedByName: schedule.feedbackModifiedByName || '',
        feedbackModifiedAt: schedule.feedbackModifiedAt ? schedule.feedbackModifiedAt.toISOString() : '',
        // Add media fields - transformer already converts to arrays
        feedbackImages: schedule.feedbackImages || [],
        feedbackVideos: schedule.feedbackVideos || [],
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNext = validatedPage < totalPages;
    const hasPrev = validatedPage > 1;

    return {
      feedbacks,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async remove(id: number) {
    const schedule = await this.findOne(id);
    if (!schedule) {
      return null;
    }
    await this.scheduleRepo.delete(id); // More efficient than remove()
    return schedule;
  }

  async getScheduleByStudentCourse(studentId: number, courseId: number) {
    return this.scheduleRepo.find({ where: { studentId, courseId } });
  }

  async getSchedulesForTeacher(teacherId: number) {
    return this.scheduleRepo.find({ where: { teacherId } });
  }

  async checkConflict(dto: CheckScheduleConflictDto) {
    const { date, startTime, endTime, room, teacherId, studentId, excludeId } =
      dto;

    const queryBuilder = this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.course', 'course')
      .leftJoinAndSelect('s.teacher', 'teacher')
      .leftJoinAndSelect('s.student', 'student')
      .where('s.date = :date', { date })
      .andWhere('s.attendance != :attendance', { attendance: 'cancelled' })
      .andWhere(
        '(s.room = :room OR s.teacher.id = :teacherId OR s.student.id = :studentId)',
        {
          room,
          teacherId,
          studentId,
        },
      )
      .andWhere('s.startTime < :endTime AND s.endTime > :startTime', {
        startTime,
        endTime,
      });

    if (excludeId !== undefined && excludeId !== null) {
      queryBuilder.andWhere('s.id != :excludeId', { excludeId });
    }

    const existing = await queryBuilder.getOne();

    if (existing) {
      const isRoomConflict = existing.room === room;
      const isTeacherConflict = existing.teacher?.id === teacherId;
      const isStudentConflict = existing.student?.id === studentId;

      let conflictType:
        | 'room'
        | 'teacher'
        | 'student'
        | 'room_teacher'
        | 'room_student'
        | 'teacher_student'
        | 'all' = 'room';

      if (isRoomConflict && isTeacherConflict && isStudentConflict) {
        conflictType = 'all';
      } else if (isRoomConflict && isTeacherConflict) {
        conflictType = 'room_teacher';
      } else if (isRoomConflict && isStudentConflict) {
        conflictType = 'room_student';
      } else if (isTeacherConflict && isStudentConflict) {
        conflictType = 'teacher_student';
      } else if (isTeacherConflict) {
        conflictType = 'teacher';
      } else if (isStudentConflict) {
        conflictType = 'student';
      }

      return {
        conflictType,
        room: existing.room || 'Unknown',
        time: `${existing.startTime} - ${existing.endTime}`,
        startTime: existing.startTime,
        endTime: existing.endTime,
        courseTitle: existing.course?.title || 'Unknown',
        teacherName: existing.teacher?.name || 'Unknown',
        studentName: existing.student?.name || 'Unknown',
      };
    }
    return null;
  }

  async checkConflicts(schedules: CheckScheduleConflictDto[]) {
    const conflicts: {
      date: string;
      time: string;
      room: string;
      startTime: string;
      endTime: string;
      conflictType:
        | 'room'
        | 'teacher'
        | 'student'
        | 'room_teacher'
        | 'room_student'
        | 'teacher_student'
        | 'all';
      courseTitle: string;
      teacherName: string;
      studentName: string;
    }[] = [];

    for (const {
      date,
      room,
      startTime,
      endTime,
      teacherId,
      studentId,
    } of schedules) {
      const existing = await this.scheduleRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.course', 'course')
        .leftJoinAndSelect('s.teacher', 'teacher')
        .leftJoinAndSelect('s.student', 'student')
        .where('s.date = :date', { date })
        .andWhere('s.attendance != :attendance', { attendance: 'cancelled' })
        .andWhere(
          '(s.room = :room OR s.teacher.id = :teacherId OR s.student.id = :studentId)',
          {
            room,
            teacherId,
            studentId,
          },
        )
        .andWhere('s.startTime < :endTime AND s.endTime > :startTime', {
          startTime,
          endTime,
        })
        .getOne();

      if (existing) {
        const isRoomConflict = existing.room === room;
        const isTeacherConflict = existing.teacher?.id === teacherId;
        const isStudentConflict = existing.student?.id === studentId;

        let conflictType:
          | 'room'
          | 'teacher'
          | 'student'
          | 'room_teacher'
          | 'room_student'
          | 'teacher_student'
          | 'all' = 'room';

        if (isRoomConflict && isTeacherConflict && isStudentConflict) {
          conflictType = 'all';
        } else if (isRoomConflict && isTeacherConflict) {
          conflictType = 'room_teacher';
        } else if (isRoomConflict && isStudentConflict) {
          conflictType = 'room_student';
        } else if (isTeacherConflict && isStudentConflict) {
          conflictType = 'teacher_student';
        } else if (isTeacherConflict) {
          conflictType = 'teacher';
        } else if (isStudentConflict) {
          conflictType = 'student';
        }

        conflicts.push({
          date,
          time: `${existing.startTime} - ${existing.endTime}`,
          room: existing.room || 'Unknown',
          startTime,
          endTime,
          conflictType,
          courseTitle: existing.course?.title || 'Unknown',
          teacherName: existing.teacher?.name || 'Unknown',
          studentName: existing.student?.name || 'Unknown',
        });
      }
    }

    return conflicts;
  }

  async getAllSchedules() {
    // Add basic pagination to prevent loading massive datasets
    // You can modify the controller later to accept page/limit parameters
    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoin('schedule.student', 'student')
      .leftJoin('schedule.teacher', 'teacher')
      .leftJoin('schedule.course', 'course')
      .select([
        'schedule.id',
        'schedule.date',
        'schedule.startTime',
        'schedule.endTime',
        'schedule.room',
        'schedule.remark',
        'schedule.attendance',
        'schedule.feedback',
        'schedule.verifyFb',
        'schedule.warning',
        'schedule.classNumber',
        'student.name',
        'student.phone',
        'teacher.name',
        'course.title',
      ])
      .addSelect('student.id') // optional if you need
      .addSelect('teacher.id')
      .addSelect('course.id AS "schedule_courseId"')
      .orderBy('schedule.date', 'DESC')
      .addOrderBy('schedule.startTime', 'ASC')
      .limit(1000) // Reasonable limit to prevent memory issues
      .getRawMany();
  }

  async getSchedulesByDateRange(
    startDate: string,
    endDate: string,
    studentId?: number,
  ) {
    const query = this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.date >= :startDate', { startDate })
      .andWhere('s.date <= :endDate', { endDate });

    if (studentId) {
      query.andWhere('s.studentId = :studentId', { studentId });
    }

    return query.getMany();
  }

  async getTodaySchedules(id?: number): Promise<any[]> {
    const today = new Date();
    const todayDateString = today.toLocaleDateString('en-CA');

    const queryBuilder = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .where('DATE(schedule.date) = :today', { today: todayDateString })
      .andWhere('schedule.attendance != :attendance', {
        attendance: 'cancelled',
      });

    // If teacher ID is provided, filter by that teacher
    if (id) {
      queryBuilder.andWhere('schedule.teacherId = :teacherId', {
        teacherId: id,
      });
    }

    const schedules = await queryBuilder
      .select([
        'schedule.id',
        'DATE(schedule.date) as schedule_date', // Format date directly in SQL
        'schedule.startTime',
        'schedule.endTime',
        'schedule.room',
        'schedule.remark',
        'schedule.attendance',
        'schedule.feedback',
        'schedule.verifyFb',
        'schedule.warning',
        'student.id',
        'student.name',
        'student.nickname',
        'student.phone',
        'schedule.classNumber',
        'student.profilePicture',
        'teacher.name',
        'course.title',
        'course.id AS "schedule_courseId"',
      ])
      .orderBy('schedule.startTime', 'ASC')
      .getRawMany();

    return schedules;
  }

  async getSchedulesByRangeAndFilters(filterDto: FilterScheduleDto) {
    const {
      startDate,
      endDate,
      studentName,
      teacherName,
      courseName,
      attendanceStatus,
      classStatus,
      classOption,
      room,
      sort,
      page = 1,
      pageSize, // Remove default value here since it's already set in controller
    } = filterDto;

    // Use 10 as fallback if pageSize is still undefined
    const actualPageSize = pageSize || 10;


    const qb = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .leftJoinAndSelect('schedule.session', 'session')
      .leftJoinAndSelect('session.classOption', 'classOption');

    // Track if any filters are applied
    let filtersApplied = 0;

    if (startDate) {
      console.log('Applying startDate filter:', startDate);
      qb.andWhere('schedule.date >= :startDate', { startDate });
      filtersApplied++;
    }
    if (endDate) {
      console.log('Applying endDate filter:', endDate);
      qb.andWhere('schedule.date <= :endDate', { endDate });
      filtersApplied++;
    }
    if (studentName) {
      console.log('Applying studentName filter:', studentName);
      qb.andWhere('student.name ILIKE :studentName', {
        studentName: `%${studentName}%`,
      });
      filtersApplied++;
    }
    if (teacherName) {
      console.log('Applying teacherName filter:', teacherName);
      qb.andWhere('teacher.name ILIKE :teacherName', {
        teacherName: `%${teacherName}%`,
      });
      filtersApplied++;
    }
    if (courseName) {
      console.log('Applying courseName filter:', courseName);
      qb.andWhere('course.title ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
      filtersApplied++;
    }
    if (attendanceStatus && attendanceStatus !== 'all') {
      console.log('Applying attendanceStatus filter:', attendanceStatus);
      qb.andWhere('schedule.attendance = :attendanceStatus', {
        attendanceStatus,
      });
      filtersApplied++;
    }
    if (classStatus && classStatus !== 'all') {
      console.log('Applying classStatus filter:', classStatus);
      qb.andWhere('schedule.status = :classStatus', { classStatus });
      filtersApplied++;
    }
    if (room) {
      console.log('Applying room filter:', room);
      qb.andWhere('schedule.room ILIKE :room', { room: `%${room}%` });
      filtersApplied++;
    }
    if (classOption && classOption !== 'all') {
      console.log('Applying classOption filter:', classOption);
      qb.andWhere('classOption.classMode = :classOption', {
        classOption,
      });
      filtersApplied++;
    }

    console.log('Total filters applied:', filtersApplied);

    // Get total count before applying pagination
    const totalCount = await qb.getCount();
    console.log('Total count after filters:', totalCount);

    // Sorting
    switch (sort) {
      case 'date_asc':
        qb.orderBy('schedule.date', 'ASC');
        break;
      case 'date_desc':
        qb.orderBy('schedule.date', 'DESC');
        break;
      case 'time_asc':
        qb.orderBy('schedule.startTime', 'ASC');
        break;
      case 'time_desc':
        qb.orderBy('schedule.startTime', 'DESC');
        break;
      case 'student_asc':
        qb.orderBy('student.name', 'ASC');
        break;
      case 'student_desc':
        qb.orderBy('student.name', 'DESC');
        break;
      case 'teacher_asc':
        qb.orderBy('teacher.name', 'ASC');
        break;
      case 'teacher_desc':
        qb.orderBy('teacher.name', 'DESC');
        break;
      case 'room_asc':
        qb.orderBy('schedule.room', 'ASC');
        break;
      case 'room_desc':
        qb.orderBy('schedule.room', 'DESC');
        break;
      case 'class_option_asc':
        qb.orderBy('classOption.classMode', 'ASC');
        break;
      case 'class_option_desc':
        qb.orderBy('classOption.classMode', 'DESC');
        break;
      default:
        qb.orderBy('schedule.date', 'ASC');
    }

    // Apply pagination
    const offset = (page - 1) * actualPageSize;
    qb.skip(offset).take(actualPageSize);


    // Try using getMany() instead of getRawMany() to see if pagination works
    const schedulesEntities = await qb.getMany();
    console.log(
      'Number of schedule entities returned:',
      schedulesEntities.length,
    );

    // Transform entities to the expected format
    const schedules = schedulesEntities.map((schedule) => ({
      schedule_id: schedule.id,
      schedule_date: schedule.date,
      schedule_startTime: schedule.startTime,
      schedule_endTime: schedule.endTime,
      schedule_room: schedule.room,
      schedule_attendance: schedule.attendance,
      schedule_remark: schedule.remark,
      schedule_classNumber: schedule.classNumber,
      schedule_warning: schedule.warning,
      schedule_feedback: schedule.feedback,
      schedule_feedbackDate: schedule.feedbackDate,
      schedule_verifyFb: schedule.verifyFb,
      schedule_courseId: schedule.courseId,
      course_title: schedule.course?.title || null,
      teacher_name: schedule.teacher?.name || 'TBD',
      student_id: schedule.student?.id || null,
      student_name: schedule.student?.name || null,
      student_nickname: schedule.student?.nickname || null,
      student_phone: schedule.student?.phone || null,
      student_profilePicture: schedule.student?.profilePicture || null,
      class_option: schedule.session?.classOption?.classMode || null,
    }));

    console.log('Schedules are as follows', schedules);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / actualPageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      schedules,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getSchedulesByStudentAndSession(sessionId: number, studentId: number) {
    // for the relations select only student name, teacher name and course title
    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoin('schedule.student', 'student')
      .leftJoin('schedule.teacher', 'teacher')
      .leftJoin('schedule.course', 'course')
      .addSelect([
        'student.name',
        'student.nickname',
        'student.phone',
        'student.profilePicture',
        'teacher.name',
        'course.title',
      ])
      .where('schedule.sessionId = :sessionId', { sessionId })
      .andWhere('schedule.studentId = :studentId', { studentId })
      .orderBy('schedule.date', 'ASC')
      .getRawMany();
  }

  async getSchedulesBySession(sessionId: number) {
    // Get schedules by session - return entities with relations
    const schedules = await this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .leftJoinAndSelect('schedule.session', 'session')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('schedule.sessionId = :sessionId', { sessionId })
      .orderBy('schedule.date', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany();

    return schedules;
  }

  async updateAttendance(scheduleId: number, attendance: string) {
    const schedule = await this.scheduleRepo.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    schedule.attendance = attendance;
    await this.scheduleRepo.save(schedule);

    return {
      success: true,
      message: `Attendance updated to ${attendance}`,
      schedule,
    };
  }
}
