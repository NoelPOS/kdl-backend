import { Injectable } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { Repository } from 'typeorm';
import { Schedule } from 'src/schedule/entities/schedule.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
  ) {}

  async create(dto: CreateSessionDto) {
    const session = this.sessionRepository.create(dto);
    return await this.sessionRepository.save(session);
  }

  async findAll() {
    return this.sessionRepository.find({ relations: ['course'] });
  }

  async findOne(id: number) {
    return this.sessionRepository.findOne({
      where: { id },
      relations: ['course'],
    });
  }

  async update(id: number, dto: UpdateSessionDto) {
    await this.sessionRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const session = await this.findOne(id);
    if (!session) {
      // Or throw a NotFoundException
      return null;
    }
    await this.sessionRepository.remove(session);
    return session;
  }

  async getStudentSessions(studentId: number) {
    return this.sessionRepository.find({
      where: { studentId },
      relations: ['course', 'teacher'],
    });
  }

  async getStudentSessionByCourse(studentId: number, courseId: number) {
    return this.sessionRepository.findOne({
      where: { studentId, courseId },
      relations: ['course', 'teacher'],
    });
  }

  async getSessionOverviewByStudentId(studentId: number) {
    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .where('session.studentId = :studentId', { studentId })
      .getMany();

    const result = [];

    for (const s of sessions) {
      // Count schedules that are "Completed" for this session
      const completedCount = await this.scheduleRepo.count({
        where: {
          sessionId: s.id,
          attendance: 'Completed',
        },
      });

      result.push({
        sessionId: s.id,
        courseTitle: s.course?.title,
        courseDescription: s.course?.description,
        mode: s.mode,
        payment: s.payment,
        completedCount,
        classCancel: s.classCancel,
      });
    }

    return result;
  }
}
