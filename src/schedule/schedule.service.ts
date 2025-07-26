import { Injectable } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { CheckScheduleConflictDto } from './dto/check-schedule-conflict.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
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
    return this.scheduleRepo.findOne({ where: { id } });
  }

  async updateSchedule(
    id: number,
    dto: Partial<CreateScheduleDto & { warning?: string }>,
  ) {
    // Only pick fields that exist in the Schedule entity
    const updateFields: any = {};
    if (dto.date !== undefined) updateFields.date = dto.date;
    if (dto.startTime !== undefined) updateFields.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateFields.endTime = dto.endTime;
    if (dto.room !== undefined) updateFields.room = dto.room;
    if (dto.remark !== undefined) updateFields.remark = dto.remark;
    if (dto.attendance !== undefined) updateFields.attendance = dto.attendance;
    if (dto.teacherId !== undefined) updateFields.teacherId = dto.teacherId;
    if (dto.warning !== undefined) updateFields.warning = dto.warning;
    // The following fields are not in the entity: teacherName, studentName, nickname, courseName
    // If you want to update related entities, you need to handle that separately

    const result = await this.scheduleRepo.update(id, updateFields);
    if (result.affected === 0) {
      return null; // Schedule not found
    }
    return this.scheduleRepo.findOne({ where: { id } });
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
        courseTitle: existing.course?.title || 'Unknown',
        teacherName: existing.teacher?.name || 'Unknown',
        studentName: existing.student?.name || 'Unknown',
      };
    }
    return null;
  }

  // async checkConflicts(schedules: CheckScheduleConflictDto[]) {
  //   const conflicts: {
  //     date: string;
  //     room: string;
  //     startTime: string;
  //     endTime: string;
  //     conflictType:
  //       | 'room'
  //       | 'teacher'
  //       | 'student'
  //       | 'room_teacher'
  //       | 'room_student'
  //       | 'teacher_student'
  //       | 'all';
  //     courseTitle: string;
  //     teacherName: string;
  //     studentName: string;
  //   }[] = [];

  //   if (schedules.length === 0) return conflicts;

  //   // Extract unique dates, teachers, students, rooms for batch query
  //   const dates = Array.from(new Set(schedules.map((s) => s.date)));
  //   const teacherIds = Array.from(new Set(schedules.map((s) => s.teacherId)));
  //   const studentIds = Array.from(new Set(schedules.map((s) => s.studentId)));
  //   const rooms = Array.from(new Set(schedules.map((s) => s.room)));

  //   // Single query to get all potential conflicts
  //   const existingSchedules = await this.scheduleRepo
  //     .createQueryBuilder('s')
  //     .leftJoinAndSelect('s.course', 'course')
  //     .leftJoinAndSelect('s.teacher', 'teacher')
  //     .leftJoinAndSelect('s.student', 'student')
  //     .where('s.date IN (:...dates)', { dates })
  //     .andWhere(
  //       '(s.room IN (:...rooms) OR s.teacherId IN (:...teacherIds) OR s.studentId IN (:...studentIds))',
  //       { rooms, teacherIds, studentIds },
  //     )
  //     .getMany();

  //   // Check each schedule against existing ones
  //   for (const {
  //     date,
  //     room,
  //     startTime,
  //     endTime,
  //     teacherId,
  //     studentId,
  //   } of schedules) {
  //     // Find conflicts for this specific schedule
  //     const existing = existingSchedules.find(
  //       (s) =>
  //         s.date.toISOString().split('T')[0] === date &&
  //         (s.room === room ||
  //           s.teacher?.id === teacherId ||
  //           s.student?.id === studentId) &&
  //         s.startTime < endTime &&
  //         s.endTime > startTime,
  //     );

  //     if (existing) {
  //       const isRoomConflict = existing.room === room;
  //       const isTeacherConflict = existing.teacher?.id === teacherId;
  //       const isStudentConflict = existing.student?.id === studentId;

  //       let conflictType:
  //         | 'room'
  //         | 'teacher'
  //         | 'student'
  //         | 'room_teacher'
  //         | 'room_student'
  //         | 'teacher_student'
  //         | 'all' = 'room';

  //       if (isRoomConflict && isTeacherConflict && isStudentConflict) {
  //         conflictType = 'all';
  //       } else if (isRoomConflict && isTeacherConflict) {
  //         conflictType = 'room_teacher';
  //       } else if (isRoomConflict && isStudentConflict) {
  //         conflictType = 'room_student';
  //       } else if (isTeacherConflict && isStudentConflict) {
  //         conflictType = 'teacher_student';
  //       } else if (isTeacherConflict) {
  //         conflictType = 'teacher';
  //       } else if (isStudentConflict) {
  //         conflictType = 'student';
  //       }

  //       conflicts.push({
  //         date,
  //         room,
  //         startTime,
  //         endTime,
  //         conflictType,
  //         courseTitle: existing.course?.title || 'Unknown',
  //         teacherName: existing.teacher?.name || 'Unknown',
  //         studentName: existing.student?.name || 'Unknown',
  //       });
  //     }
  //   }

  //   return conflicts;
  // }

  async checkConflicts(schedules: CheckScheduleConflictDto[]) {
    const conflicts: {
      date: string;
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
          room,
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

  async getTodaySchedules(): Promise<any[]> {
    const today = new Date();
    const todayDateString = today.toLocaleDateString('en-CA');

    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .where('DATE(schedule.date) = :today', { today: todayDateString })
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
        'student.id',
        'student.name',
        'student.nickname',
        'schedule.classNumber',
        'student.profilePicture',
        'teacher.name',
        'course.title',
        'course.id AS "schedule_courseId"',
      ])
      .orderBy('schedule.startTime', 'ASC')
      .getRawMany();
  }

  async getSchedulesByRangeAndFilters(filterDto: FilterScheduleDto) {
    console.log('Filter Schedule DTO:', filterDto);

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

    // console.log('Actual pagination values:', {
    //   page,
    //   pageSize,
    //   actualPageSize,
    // });

    // console.log('Filter values:', {
    //   startDate,
    //   endDate,
    //   studentName,
    //   teacherName,
    //   courseName,
    //   attendanceStatus,
    //   classStatus,
    //   room,
    // });

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

    // console.log(`Applying pagination: OFFSET ${offset}, LIMIT ${actualPageSize}`);
    // console.log('Final SQL with pagination:', qb.getQuery());
    // console.log('Final query parameters:', qb.getParameters());

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
      schedule_courseId: schedule.courseId,
      course_title: schedule.course?.title || null,
      teacher_name: schedule.teacher?.name || 'TBD',
      student_id: schedule.student?.id || null,
      student_name: schedule.student?.name || null,
      student_nickname: schedule.student?.nickname || null,
      student_profilePicture: schedule.student?.profilePicture || null,
      class_option: schedule.session?.classOption?.classMode || null,
    }));

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
      .addSelect(['student.name', 'teacher.name', 'course.title'])
      .where('schedule.sessionId = :sessionId', { sessionId })
      .andWhere('schedule.studentId = :studentId', { studentId })
      .getRawMany();
  }
}
