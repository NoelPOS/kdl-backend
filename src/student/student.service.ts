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
import { StudentCounter } from './entities/student-counter.entity';

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
    @InjectRepository(StudentCounter)
    private studentCounterRepository: Repository<StudentCounter>,
  ) {
    // If configService.get is not a function (seeder context), always enable DB
    if (typeof this.configService.get === 'function') {
      this.databaseEnabled =
        this.configService.get<boolean>('DATABASE_ENABLED');
    } else {
      this.databaseEnabled = true;
    }
  }

  async createStudent(createStudentDto: CreateStudentDto) {
    if (!this.databaseEnabled) {
      throw new BadRequestException('Database functionality is disabled');
    }

    try {
      // Generate studentId in YYYYMMXXXX format
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Use transaction for counter update and student creation
      const savedStudent = await this.studentRepository.manager.transaction(
        async (entityManager) => {
          // Lock the counter row for update
          let counter = await entityManager.findOne(StudentCounter, {
            where: { yearMonth },
            lock: { mode: 'pessimistic_write' },
          });
          if (!counter) {
            counter = entityManager.create(StudentCounter, {
              yearMonth,
              counter: 1,
            });
          } else {
            counter.counter += 1;
          }
          await entityManager.save(StudentCounter, counter);

          const serial = String(counter.counter).padStart(4, '0');
          const studentId = `${yearMonth}${serial}`;

          const student = entityManager.create(StudentEntity, {
            studentId,
            name: createStudentDto.name,
            nickname: createStudentDto.nickname,
            nationalId: createStudentDto.nationalId || '',
            dob: createStudentDto.dob,
            gender: createStudentDto.gender,
            school: createStudentDto.school,
            allergic: createStudentDto.allergic,
            doNotEat: createStudentDto.doNotEat,
            adConcent: createStudentDto.adConcent,
            phone: createStudentDto.phone,
            profilePicture: createStudentDto.profilePicture || '',
            profileKey: createStudentDto.profileKey || '',
          });
          return await entityManager.save(StudentEntity, student);
        },
      );
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
    courseType?: 'fixed' | 'check' | 'camp' | 'all' | '',
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
      const courseTypeMap = { fixed: 1, check: 2, camp: 3 };

      // Validate pagination
      page = Math.max(1, page);
      limit = Math.min(Math.max(1, limit), 100);
      const offset = (page - 1) * limit;

      // Base query
      const queryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoinAndSelect(
          'sessions',
          'session',
          'session.studentId = student.id',
        )
        .leftJoinAndSelect('courses', 'course', 'course.id = session.courseId')
        .select([
          'student.id',
          'student.studentId',
          'student.name',
          'student.nickname',
          'student.nationalId',
          'student.dob',
          'student.phone',
          'student.gender',
          'student.school',
          'student.allergic',
          'student.doNotEat',
          'student.adConcent',
          'student.profilePicture',
          'student.createdAt',
        ]);

      // Filters
      if (query) {
        queryBuilder.andWhere('student.name ILIKE :query', {
          query: `%${query}%`,
        });
      }

      if (active === 'active') {
        queryBuilder.andWhere('session.status = :status', { status: 'wip' });
      } else if (active === 'inactive') {
        queryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'wip' },
        );
      }

      if (course) {
        queryBuilder.andWhere('course.title ILIKE :course', {
          course: `%${course}%`,
        });
      }

      if (courseType && courseType !== 'all') {
        queryBuilder.andWhere('session.classOptionId = :courseType', {
          courseType: courseTypeMap[courseType],
        });
      }

      // Count query (must mirror main query)
      const countQueryBuilder = this.studentRepository
        .createQueryBuilder('student')
        .leftJoin('sessions', 'session', 'session.studentId = student.id')
        .leftJoin('courses', 'course', 'course.id = session.courseId');

      if (query) {
        countQueryBuilder.andWhere('student.name ILIKE :query', {
          query: `%${query}%`,
        });
      }

      if (active === 'active') {
        countQueryBuilder.andWhere('session.status = :status', {
          status: 'wip',
        });
      } else if (active === 'inactive') {
        countQueryBuilder.andWhere(
          'NOT EXISTS (SELECT 1 FROM sessions s WHERE s."studentId" = student.id AND s.status = :status)',
          { status: 'wip' },
        );
      }

      if (course) {
        countQueryBuilder.andWhere('course.title ILIKE :course', {
          course: `%${course}%`,
        });
      }

      if (courseType && courseType !== 'all') {
        countQueryBuilder.andWhere('session.classOptionId = :courseType', {
          courseType: courseTypeMap[courseType],
        });
      }

      // Total count
      const totalCount = await countQueryBuilder
        .select('COUNT(DISTINCT student.id)', 'count')
        .getRawOne()
        .then((res) => parseInt(res.count));

      const totalPages = Math.ceil(totalCount / limit);

      // Pagination and ordering
      queryBuilder.distinctOn(['student.id']);
      queryBuilder.orderBy('student.id', 'DESC');
      queryBuilder.addOrderBy('student.createdAt', 'DESC');
      queryBuilder.skip(offset).take(limit);

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
      console.error('Error in findAllStudents:', error);
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
      if (query.name) {
        where.nickname = ILike(`%${query.name}%`);
      }
      if (query.id) {
        where.studentId = query.id;
      }

      const students = await this.studentRepository.find({
        where,
        order: {
          createdAt: 'DESC',
        },
        select: [
          'id',
          'studentId',
          'name',
          'nickname',
          'nationalId',
          'dob',
          'phone',
          'school',
          'gender',
          'allergic',
          'doNotEat',
          'adConcent',
          'profilePicture',
          'createdAt',
        ],
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
      const student = await this.studentRepository.findOne({
        where: { id: studentId },
        select: [
          'id',
          'studentId',
          'name',
          'nickname',
          'nationalId',
          'gender',
          'dob',
          'phone',
          'school',
          'allergic',
          'doNotEat',
          'adConcent',
          'profilePicture',
          'createdAt',
        ],
      });
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
