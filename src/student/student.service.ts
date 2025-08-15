import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StudentEntity } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Session } from '../session/entities/session.entity';

@Injectable()
export class StudentService {
  private readonly databaseEnabled: boolean;

  constructor(
    @InjectRepository(StudentEntity)
    private studentRepository: Repository<StudentEntity>,

    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,

    private configService: ConfigService,
  ) {
    this.databaseEnabled = this.configService.get<boolean>('DATABASE_ENABLED');
  }

  async createStudent(createStudentDto: CreateStudentDto) {
    if (!this.databaseEnabled) {
      throw new BadRequestException('Database functionality is disabled');
    }

    try {
      const student = new StudentEntity();
      student.name = createStudentDto.name;
      student.nickname = createStudentDto.nickname;
      student.dob = createStudentDto.dob;
      student.gender = createStudentDto.gender;
      student.school = createStudentDto.school;
      student.allergic = createStudentDto.allergic;
      student.doNotEat = createStudentDto.doNotEat;
      student.adConcent = createStudentDto.adConcent;
      student.phone = createStudentDto.phone;
      student.profilePicture = createStudentDto.profilePicture || '';
      student.profileKey = createStudentDto.profileKey || '';

      const savedStudent = await this.studentRepository.save(student);
      return savedStudent;
    } catch (error) {
      throw new BadRequestException(
        'Failed to create student: ' + error.message,
      );
    }
  }

  async findAllStudents(
    query?: string,
    active?: string,
    course?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    students: StudentEntity[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    console.log('Fetching students with filters (OPTIMIZED FIXED):', {
      query,
      active,
      course,
      page,
      limit,
    });

    try {
      // Validate pagination parameters
      page = Math.max(1, page);
      limit = Math.min(Math.max(1, limit), 100);

      // Build the main query with joins to eliminate N+1 queries
      let queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .select([
          'student.id',
          'student.name',
          'student.nickname',
          'student.dob',
          'student.phone',
          'student.allergic',
          'student.doNotEat',
          'student.adConcent',
          'student.profilePicture',
          'student.createdAt',
        ]);

      // Apply name search filter
      if (query) {
        queryBuilder.andWhere('student.name ILIKE :query', {
          query: `%${query}%`,
        });
      }

      // Apply active/inactive filtering with proper joins
      if (active === 'active') {
        queryBuilder
          .innerJoin('sessions', 'session', 'session.studentId = student.id')
          .andWhere('session.status = :status', { status: 'WP' });
      } else if (active === 'inactive') {
        // Use NOT EXISTS subquery for inactive students
        queryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'WP' },
        );
      }

      // Apply course filtering
      if (course) {
        if (active !== 'active') {
          // Add join only if not already joined for active filter
          queryBuilder.leftJoin(
            'sessions',
            'session',
            'session.studentId = student.id',
          );
        }
        queryBuilder
          .leftJoin('courses', 'course', 'course.id = session.courseId')
          .andWhere('course.title ILIKE :course', {
            course: `%${course}%`,
          });
      }

      // For counting, we need a separate simpler query without DISTINCT
      const countQueryBuilder =
        this.studentRepository.createQueryBuilder('student');

      // Apply the same filters for counting
      if (query) {
        countQueryBuilder.andWhere('student.name ILIKE :query', {
          query: `%${query}%`,
        });
      }

      if (active === 'active') {
        countQueryBuilder
          .innerJoin('sessions', 'session', 'session.studentId = student.id')
          .andWhere('session.status = :status', { status: 'WP' });
      } else if (active === 'inactive') {
        countQueryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'WP' },
        );
      }

      if (course) {
        if (active !== 'active') {
          countQueryBuilder.leftJoin(
            'sessions',
            'session',
            'session.studentId = student.id',
          );
        }
        countQueryBuilder
          .leftJoin('courses', 'course', 'course.id = session.courseId')
          .andWhere('course.title ILIKE :course', {
            course: `%${course}%`,
          });
      }

      // Get total count with DISTINCT to handle duplicates from joins
      const totalCount = await countQueryBuilder
        .select('COUNT(DISTINCT student.id)', 'count')
        .getRawOne()
        .then((result) => parseInt(result.count));

      const totalPages = Math.ceil(totalCount / limit);

      // Apply DISTINCT and pagination to main query
      queryBuilder.distinctOn(['student.id']);
      queryBuilder.orderBy('student.id', 'DESC');
      queryBuilder.addOrderBy('student.createdAt', 'DESC');

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder.skip(offset).take(limit);

      // Execute the main query
      const students = await queryBuilder.getMany();

      return {
        students,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error in optimized findAllStudents:', error);
      throw new BadRequestException(
        'Failed to fetch students: ' + error.message,
      );
    }
  }

  // search students function with typeorm ILike
  async searchStudents(
    query: Partial<StudentEntity>,
  ): Promise<StudentEntity[]> {
    try {
      const where: any = {};
      if (query.name) {
        where.name = ILike(`%${query.name}%`);
      }
      if (query.nickname) {
        where.nickname = ILike(`%${query.nickname}%`);
      }
      if (query.school) {
        where.school = ILike(`%${query.school}%`);
      }

      const students = await this.studentRepository.find({
        where,
        order: {
          createdAt: 'DESC',
        },
      });

      return students;
    } catch (error) {
      throw new BadRequestException(
        'Failed to search students: ' + error.message,
      );
    }
  }

  async findStudentById(id: string): Promise<StudentEntity> {
    try {
      const studentId = Number(id);
      const student = await this.studentRepository.findOneBy({ id: studentId });
      if (!student) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }
      return student;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to find student with ID ${id}: ${error.message}`,
      );
    }
  }

  async updateStudent(
    id: number,
    updateStudentDto: UpdateStudentDto,
  ): Promise<StudentEntity> {
    try {
      const student = await this.studentRepository.findOneBy({ id });
      if (!student) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }

      // Update only the fields that are provided
      Object.assign(student, updateStudentDto);

      const updatedStudent = await this.studentRepository.save(student);
      return updatedStudent;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update student with ID ${id}: ${error.message}`,
      );
    }
  }
}
