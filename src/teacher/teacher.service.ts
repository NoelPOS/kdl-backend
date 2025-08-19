import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository, Not } from 'typeorm';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherCourseEntity } from './entities/teacher-course.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { CourseEntity } from '../course/entities/course.entity';
import { Session } from '../session/entities/session.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherEntity)
    private teacherRepository: Repository<TeacherEntity>,

    @InjectRepository(TeacherCourseEntity)
    private teacherCourseRepo: Repository<TeacherCourseEntity>,

    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,

    @InjectRepository(CourseEntity)
    private courseRepository: Repository<CourseEntity>,
  ) {}

  async createTeacher(
    createTeacherDto: CreateTeacherDto,
  ): Promise<TeacherEntity> {
    try {
      // Check if teacher with email already exists
      const existingTeacher = await this.teacherRepository.findOne({
        where: { email: createTeacherDto.email },
      });

      if (existingTeacher) {
        throw new BadRequestException(
          `Teacher with email ${createTeacherDto.email} already exists`,
        );
      }

      // Hash the password before saving
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createTeacherDto.password,
        saltRounds,
      );

      const teacher = new TeacherEntity();
      teacher.name = createTeacherDto.name;
      teacher.email = createTeacherDto.email;
      teacher.password = hashedPassword;
      teacher.contactNo = createTeacherDto.contactNo;
      teacher.lineId = createTeacherDto.lineId;
      teacher.address = createTeacherDto.address;
      teacher.profilePicture = createTeacherDto.profilePicture;
      teacher.profileKey = createTeacherDto.profileKey || null;

      const savedTeacher = await this.teacherRepository.save(teacher);
      return savedTeacher;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to create teacher: ' + error.message,
      );
    }
  }

  async assignCoursesToTeacher(
    teacherId: number,
    courseIds: number[],
  ): Promise<TeacherCourseEntity[]> {
    const assignments = courseIds.map((courseId) => {
      const entry = new TeacherCourseEntity();
      entry.teacherId = teacherId;
      entry.courseId = courseId;
      return entry;
    });

    return this.teacherCourseRepo.save(assignments);
  }

  async getCoursesByTeacherId(teacherId: number): Promise<CourseEntity[]> {
    const teacherCourses = await this.teacherCourseRepo.find({
      where: { teacherId },
      relations: ['course'],
    });

    return teacherCourses.map((tc) => tc.course);
  }

  async getTeacherCourses(
    teacherId: number,
    query?: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<{
    courses: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    // Verify teacher exists
    const teacher = await this.teacherRepository.findOne({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
    }

    // Build the where conditions
    let whereConditions: any = { teacherId };

    // If we have a search query, we need to use a query builder
    if (query && query.trim()) {
      const queryBuilder = this.teacherCourseRepo
        .createQueryBuilder('tc')
        .leftJoinAndSelect('tc.course', 'course')
        .where('tc.teacherId = :teacherId', { teacherId })
        .andWhere('LOWER(course.name) LIKE LOWER(:query)', {
          query: `%${query}%`,
        });

      // Get total count for pagination
      const totalCount = await queryBuilder.getCount();
      const totalPages = Math.ceil(totalCount / limit);

      // Get the results with pagination
      const courses = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .addOrderBy('course.name', 'ASC')
        .getMany();

      // Transform the result - return only courses
      const transformedCourses = courses.map((tc) => tc.course);

      return {
        courses: transformedCourses,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } else {
      // For simple queries without search, use find with relations
      const [courses, totalCount] = await this.teacherCourseRepo.findAndCount({
        where: { teacherId },
        relations: ['course'],
        skip: (page - 1) * limit,
        take: limit,
        order: {
          id: 'ASC', // Order by the teacher_course id for consistency
        },
      });

      const totalPages = Math.ceil(totalCount / limit);

      // Transform the result - return only courses
      const transformedCourses = courses.map((tc) => tc.course);

      return {
        courses: transformedCourses,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }
  }

  async getTeachersByCourseId(courseId: number): Promise<TeacherEntity[]> {
    const teacherCourses = await this.teacherCourseRepo.find({
      where: { courseId },
      relations: ['teacher'],
    });
    return teacherCourses.map((tc) => tc.teacher);
  }

  async findTeacherByName(name: string): Promise<TeacherEntity[]> {
    return await this.teacherRepository.find({
      where: { name: ILike(`%${name}%`) },
    });
  }

  async findAllTeachers(
    query?: string,
    status?: string,
    course?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    teachers: TeacherEntity[];
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
      limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

      let filteredTeacherIds: number[] | null = null;

      // Handle status filtering (active/inactive)
      if (status === 'active' || status === 'inactive') {
        // Get teachers who have pending sessions (active)
        const pendingSessions = await this.sessionRepo.find({
          where: { status: 'WP' },
        });

        // Get unique teacher IDs from teacher-course assignments for sessions
        const sessionCourseIds = [
          ...new Set(pendingSessions.map((session) => session.courseId)),
        ];

        if (sessionCourseIds.length > 0) {
          const teacherCourses = await this.teacherCourseRepo.find({
            where: { courseId: In(sessionCourseIds) },
          });
          const activeTeacherIds = [
            ...new Set(teacherCourses.map((tc) => tc.teacherId)),
          ];

          if (status === 'active') {
            filteredTeacherIds = activeTeacherIds;
            if (activeTeacherIds.length === 0) {
              return {
                teachers: [],
                pagination: {
                  currentPage: page,
                  totalPages: 0,
                  totalCount: 0,
                  hasNext: false,
                  hasPrev: false,
                },
              };
            }
          } else if (status === 'inactive') {
            filteredTeacherIds = activeTeacherIds;
          }
        } else if (status === 'active') {
          // No pending sessions, so no active teachers
          return {
            teachers: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
      }

      // Handle course filtering
      if (course) {
        const courseEntity = await this.courseRepository.findOne({
          where: { title: ILike(`%${course}%`) },
          select: ['id'],
        });

        if (courseEntity) {
          const teacherCourses = await this.teacherCourseRepo.find({
            where: { courseId: courseEntity.id },
          });
          const courseTeacherIds = teacherCourses.map((tc) => tc.teacherId);

          if (filteredTeacherIds !== null) {
            if (status === 'active') {
              filteredTeacherIds = filteredTeacherIds.filter((id) =>
                courseTeacherIds.includes(id),
              );
            } else if (status === 'inactive') {
              filteredTeacherIds = courseTeacherIds.filter(
                (id) => !filteredTeacherIds.includes(id),
              );
            }
          } else {
            filteredTeacherIds = courseTeacherIds;
          }
        } else {
          return {
            teachers: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
      }

      // Build where clause
      const where: any = {};

      if (query) {
        where.name = ILike(`%${query}%`);
      }

      if (filteredTeacherIds !== null) {
        if (status === 'inactive' && !course) {
          if (filteredTeacherIds.length === 0) {
            // All teachers are inactive
            // No additional filter needed
          } else {
            where.id = Not(In(filteredTeacherIds));
          }
        } else {
          if (filteredTeacherIds.length === 0) {
            return {
              teachers: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false,
              },
            };
          }
          where.id = In(filteredTeacherIds);
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const totalCount = await this.teacherRepository.count({ where });
      const totalPages = Math.ceil(totalCount / limit);

      // Fetch paginated teachers
      const teachers = await this.teacherRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

      return {
        teachers,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to fetch teachers: ' + error.message,
      );
    }
  }

  async searchTeachersByName(name: string): Promise<TeacherEntity[]> {
    try {
      return await this.teacherRepository.find({
        where: { name: ILike(`%${name}%`) },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      throw new BadRequestException(
        'Failed to search teachers: ' + error.message,
      );
    }
  }

  async updateTeacher(
    id: number,
    updateTeacherDto: UpdateTeacherDto,
  ): Promise<TeacherEntity> {
    try {
      const teacher = await this.teacherRepository.findOneBy({ id });
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }

      // If password is being updated, hash it first
      if (updateTeacherDto.password) {
        const saltRounds = 10;
        updateTeacherDto.password = await bcrypt.hash(
          updateTeacherDto.password,
          saltRounds,
        );
      }

      Object.assign(teacher, updateTeacherDto);
      const updatedTeacher = await this.teacherRepository.save(teacher);
      return updatedTeacher;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update teacher with ID ${id}: ${error.message}`,
      );
    }
  }

  async findTeacherById(id: number): Promise<TeacherEntity> {
    try {
      const teacher = await this.teacherRepository.findOneBy({ id });
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }
      return teacher;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to find teacher with ID ${id}: ${error.message}`,
      );
    }
  }

  // Authentication methods
  async findByEmail(email: string): Promise<TeacherEntity> {
    const teacher = await this.teacherRepository.findOne({
      where: { email },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  async findById(id: number): Promise<TeacherEntity> {
    const teacher = await this.teacherRepository.findOne({
      where: { id },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }
}
