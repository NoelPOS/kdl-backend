import { Injectable } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { CheckScheduleConflictDto } from './dto/check-schedule-conflict.dto';

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

  async updateSchedule(id: number, dto: Partial<CreateScheduleDto>) {
    const result = await this.scheduleRepo.update(id, dto);
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
    const { date, startTime, endTime, room, teacherId, studentId } = dto;

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

  async getSchedulesByRangeAndStudentName(
    startDate: string,
    endDate: string,
    studentName: string,
  ) {
    const query = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoin('schedule.student', 'student')
      .leftJoin('schedule.teacher', 'teacher')
      .leftJoin('schedule.course', 'course')
      .where('schedule.date >= :startDate', { startDate })
      .andWhere('schedule.date <= :endDate', { endDate });

    if (studentName !== 'all') {
      query.andWhere('student.name = :studentName', { studentName });
    }

    return query
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
      .addSelect('student.id')
      .addSelect('teacher.id')
      .addSelect('course.id')
      .orderBy('schedule.date', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getRawMany();
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
