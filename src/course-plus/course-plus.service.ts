import { Injectable } from '@nestjs/common';
import { CreateCoursePlusDto } from './dto/create-course-plus.dto';
import { UpdateCoursePlusDto } from './dto/update-course-plus.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { CoursePlus } from './entities/course-plus.entity';
import { Session } from '../session/entities/session.entity';

@Injectable()
export class CoursePlusService {
  constructor(
    @InjectRepository(CoursePlus)
    private readonly coursePlusRepo: Repository<CoursePlus>,
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async create(createCoursePlusDto: CreateCoursePlusDto) {
    // Destructure schedules from DTO
    const { schedules, ...coursePlusData } = createCoursePlusDto;
    // Create and save CoursePlus
    const coursePlus = this.coursePlusRepo.create(coursePlusData);
    await this.coursePlusRepo.save(coursePlus);

    // Create and save schedules
    const createdSchedules: Schedule[] = [];
    for (const sched of schedules) {
      const schedule = this.scheduleRepo.create({
        ...sched,
        sessionId: coursePlus.sessionId,
        coursePlusId: coursePlus.id,
      });
      await this.scheduleRepo.save(schedule);
      createdSchedules.push(schedule);
    }

    return {
      coursePlus,
      schedules: createdSchedules,
    };
  }

  findAll() {
    return `This action returns all coursePlus`;
  }

  findOne(id: number) {
    return `This action returns a #${id} coursePlus`;
  }

  async updateStatus(id: number, status: string) {
    const coursePlus = await this.coursePlusRepo.findOne({ where: { id } });
    if (!coursePlus) {
      throw new Error(`CoursePlus with ID ${id} not found`);
    }

    // Validate status value
    const validStatuses = ['paid', 'unpaid'];
    if (!validStatuses.includes(status.toLowerCase())) {
      throw new Error(
        `Invalid status: ${status}. Valid values are: ${validStatuses.join(', ')}`,
      );
    }

    await this.coursePlusRepo.update(id, { status: status.toLowerCase() });
    return this.coursePlusRepo.findOne({ where: { id } });
  }

  update(id: number, updateCoursePlusDto: UpdateCoursePlusDto) {
    return `This action updates a #${id} coursePlus`;
  }

  remove(id: number) {
    return `This action removes a #${id} coursePlus`;
  }
}
