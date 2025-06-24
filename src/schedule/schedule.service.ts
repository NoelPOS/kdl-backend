import { Injectable } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Repository, LessThan, MoreThan } from 'typeorm';

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

  async updateSchedule(id: number, dto: UpdateScheduleDto) {
    await this.scheduleRepo.update(id, dto);
    return this.scheduleRepo.findOne({ where: { id } });
  }

  async remove(id: number) {
    const schedule = await this.findOne(id);
    if (!schedule) {
      // You might want to throw an exception here
      return null;
    }
    await this.scheduleRepo.remove(schedule);
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
      .addSelect('course.id')
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
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.student', 'student')
      .leftJoinAndSelect('schedule.teacher', 'teacher')
      .leftJoinAndSelect('schedule.course', 'course')
      .where('schedule.date = :today', { today })
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
      ])
      .addSelect('course.id')
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
    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoin('schedule.student', 'student')
      .leftJoin('schedule.teacher', 'teacher')
      .leftJoin('schedule.course', 'course')
      .leftJoin('schedule.session', 'session')
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
        'schedule.classNumber',
        'schedule.warning',
        'student.id',
        'student.name',
        'student.nickname',
        'student.profilePicture',
        'teacher.id',
        'teacher.name',
        'course.id',
        'course.title',
        'session.mode',
      ])
      .where('schedule.sessionId = :sessionId', { sessionId })
      .andWhere('schedule.studentId = :studentId', { studentId })
      .orderBy('schedule.date', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getRawMany();
  }
}
