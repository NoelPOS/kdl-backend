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
        title: ILike(`%${name}%`),
      },
      select: ['id', 'title'],
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

  async filter(
    ageRange?: string,
    medium?: string,
    query?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    courses: CourseEntity[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Validate pagination parameters
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    const where: any = {};
    if (ageRange && ageRange !== 'all') {
      where.ageRange = ageRange;
    }
    if (medium && medium !== 'all') {
      where.medium = medium;
    }
    if (query && query.trim() !== '') {
      where.title = ILike(`%${query}%`);
    }

    // Calculate pagination values
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await this.courseRepository.count({ where });

    // Get paginated results
    const courses = await this.courseRepository.find({
      where,
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      courses,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }
}
