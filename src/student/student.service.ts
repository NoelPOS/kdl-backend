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
import { ParentEntity } from '../parent/entities/parent.entity';
import { ParentStudentEntity } from '../parent/entities/parent-student.entity';

@Injectable()
export class StudentService {
  private readonly databaseEnabled: boolean;

  constructor(
    @InjectRepository(StudentEntity)
    private studentRepository: Repository<StudentEntity>,

    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,

    @InjectRepository(ParentEntity)
    private parentRepository: Repository<ParentEntity>,

    @InjectRepository(ParentStudentEntity)
    private parentStudentRepository: Repository<ParentStudentEntity>,

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
      student.nationalId = createStudentDto.nationalId || '';
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
          'student.nationalId',
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
          .andWhere('session.status = :status', { status: 'wip' });
      } else if (active === 'inactive') {
        // Use NOT EXISTS subquery for inactive students
        queryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'wip' },
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
          .andWhere('session.status = :status', { status: 'wip' });
      } else if (active === 'inactive') {
        countQueryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'wip' },
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
    query: Partial<StudentEntity & { id?: number }>,
  ): Promise<StudentEntity[]> {
    try {
      const where: any = {};

      if (query.name) {
        where.name = ILike(`%${query.name}%`);
      }
      if (query.nickname) {
        where.nickname = ILike(`%${query.nickname}%`);
      }
      if (query.id) {
        where.id = query.id;
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

  async findStudentById(
    id: string,
  ): Promise<StudentEntity & { parent: string }> {
    try {
      const studentId = Number(id);
      const student = await this.studentRepository.findOneBy({ id: studentId });
      if (!student) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }

      // Get parent information
      const parentStudentRelations = await this.parentStudentRepository.find({
        where: {
          studentId,
          isPrimary: true,
        },

        relations: ['parent'],
      });

      return {
        ...student,
        parent: parentStudentRelations[0]?.parent.name,
      };
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

      // Handle parent connection if parentId is provided
      if (updateStudentDto.parentId) {
        // Verify parent exists
        const parent = await this.parentRepository.findOneBy({
          id: updateStudentDto.parentId,
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent with ID ${updateStudentDto.parentId} not found`,
          );
        }

        // Check if connection already exists
        const existingConnection = await this.parentStudentRepository.findOne({
          where: { parentId: updateStudentDto.parentId, studentId: id },
        });

        if (!existingConnection) {
          // First, set all existing primary parents for this student to false
          await this.parentStudentRepository.update(
            { studentId: id, isPrimary: true },
            { isPrimary: false },
          );

          // Create new parent-student connection and mark it as primary
          const parentStudentConnection = new ParentStudentEntity();
          parentStudentConnection.parentId = updateStudentDto.parentId;
          parentStudentConnection.studentId = id;
          parentStudentConnection.isPrimary = true; // Set as primary when connecting through student update

          await this.parentStudentRepository.save(parentStudentConnection);
        } else if (!existingConnection.isPrimary) {
          // If connection exists but is not primary, make it primary and demote others
          await this.parentStudentRepository.update(
            { studentId: id, isPrimary: true },
            { isPrimary: false },
          );

          // Set this connection as primary
          await this.parentStudentRepository.update(
            { id: existingConnection.id },
            { isPrimary: true },
          );
        }
        // If connection already exists and is already primary, no action needed
      }

      // Remove parentId from updateStudentDto before updating student entity
      // since it's not a direct field on the student entity
      const { parentId, ...studentUpdateData } = updateStudentDto;

      // Update only the fields that are provided
      Object.assign(student, studentUpdateData);

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

  async searchParentsByName(name: string): Promise<ParentEntity[]> {
    try {
      return this.parentRepository.find({
        where: { name: ILike(`%${name}%`) },
        order: { name: 'ASC' },
      });
    } catch (error) {
      throw new BadRequestException(
        'Failed to search parents: ' + error.message,
      );
    }
  }
}
