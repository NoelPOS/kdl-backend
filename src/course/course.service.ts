import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseEntity } from './entities/course.entity';
import { ILike, Repository } from 'typeorm';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async create(createCourseDto: CreateCourseDto) {
    const course = this.courseRepository.create(createCourseDto);
    return this.courseRepository.save(course);
  }

  async findAll() {
    return this.courseRepository.find();
  }

  async findOne(id: number) {
    return this.courseRepository.findOne({ where: { id } });
  }

  async search(name: string) {
    return this.courseRepository.find({
      where: {
        title: ILike(`%${name}%`), // case-insensitive, partial match
      },
    });
  }

  async update(id: number, updateCourseDto: UpdateCourseDto) {
    await this.courseRepository.update(id, updateCourseDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const course = await this.findOne(id);
    if (!course) {
      return null;
    }
    await this.courseRepository.remove(course);
    return course;
  }

  async filter(ageRange: string, medium: string) {
    const where: any = {};
    if (ageRange !== 'all') {
      where.ageRange = ageRange;
    }
    if (medium !== 'all') {
      where.medium = medium;
    }
    return this.courseRepository.find({ where });
  }
}
