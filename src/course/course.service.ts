import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseEntity } from './entities/course.entity';
import { ILike, Not, Repository } from 'typeorm';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(CourseEntity)
    private readonly courseRepository: Repository<CourseEntity>,
  ) {}

  async create(createCourseDto: CreateCourseDto) {
    const existingCourse = await this.courseRepository.findOne({
      where: {
        title: createCourseDto.title,
        ageRange: createCourseDto.ageRange,
        medium: createCourseDto.medium,
      },
    });

    if (existingCourse) {
      throw new BadRequestException(
        'A course with the same title, description, age range, and medium already exists.',
      );
    }

    const course = this.courseRepository.create(createCourseDto);
    return this.courseRepository.save(course);
  }

  async findAll() {
    return this.courseRepository
      .createQueryBuilder('course')
      .where('course.title NOT ILIKE :package', { package: '%package%' })
      .andWhere('course.title NOT ILIKE :tbc', { tbc: '%TBC%' })
      .andWhere('course.title NOT ILIKE :courses', { courses: '%courses%' })
      .orderBy('course.id', 'ASC')
      .getMany();
  }

  async findOne(id: number) {
    return this.courseRepository.findOne({ where: { id } });
  }

  async search(name: string) {
    return this.courseRepository
      .createQueryBuilder('course')
      .where('course.title ILIKE :name', { name: `%${name}%` })
      .andWhere('course.title NOT ILIKE :package', { package: '%package%' })
      .andWhere('course.title NOT ILIKE :tbc', { tbc: '%TBC%' })
      .andWhere('course.title NOT ILIKE :courses', { courses: '%courses%' })
      .select(['course.id', 'course.title', 'course.ageRange', 'course.medium'])
      .getMany();
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

    // Calculate pagination values
    const skip = (page - 1) * limit;

    // Build query with QueryBuilder for better control
    let queryBuilder = this.courseRepository
      .createQueryBuilder('course')
      .where('course.title NOT ILIKE :package', { package: '%package%' })
      .andWhere('course.title NOT ILIKE :tbc', { tbc: '%TBC%' })
      .andWhere('course.title NOT ILIKE :courses', { courses: '%courses%' });

    // Add filters
    if (ageRange && ageRange !== 'all') {
      queryBuilder = queryBuilder.andWhere('course.ageRange = :ageRange', { ageRange });
    }
    if (medium && medium !== 'all') {
      queryBuilder = queryBuilder.andWhere('course.medium = :medium', { medium });
    }
    if (query && query.trim() !== '') {
      queryBuilder = queryBuilder.andWhere('course.title ILIKE :query', { query: `%${query}%` });
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Get paginated results
    const courses = await queryBuilder
      .orderBy('course.id', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

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
