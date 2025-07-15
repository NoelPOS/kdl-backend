import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { ILike, In, Repository, UpdateResult, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import { CreateStudentDto } from '../dto/create-student.dto';
import { StudentEntity } from '../entities/student.entity';
import { CreateTeacherDto } from '../dto/create-teacher.dto';
import { TeacherEntity } from '../entities/teacher.entity';
import { TeacherCourseEntity } from '../entities/teacher-course.entity';
import { CourseEntity } from '../../course/entities/course.entity';
import { ParentEntity } from '../entities/parent.entity';
import { CreateParentDto } from '../dto/create-parent.dto';
import { ParentStudentEntity } from '../entities/parent-student.entity';
import { Session } from '../../session/entities/session.entity';

@Injectable()
export class UserService {
  private readonly databaseEnabled: boolean;

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @InjectRepository(StudentEntity)
    private studentRepository: Repository<StudentEntity>,

    @InjectRepository(TeacherEntity)
    private teacherRepository: Repository<TeacherEntity>,

    @InjectRepository(TeacherCourseEntity)
    private teacherCourseRepo: Repository<TeacherCourseEntity>,

    @InjectRepository(Session)
    private sessionRepo: Repository<Session>,

    @InjectRepository(ParentEntity)
    private parentRepository: Repository<ParentEntity>,

    @InjectRepository(ParentStudentEntity)
    private parentStudentRepo: Repository<ParentStudentEntity>,

    @InjectRepository(CourseEntity)
    private courseRepository: Repository<CourseEntity>,

    private configService: ConfigService,
  ) {
    this.databaseEnabled = this.configService.get<boolean>('DATABASE_ENABLED');
    console.log(`Database enabled: ${this.databaseEnabled}`);
  }

  async create(userDto: CreateUserDto): Promise<UserEntity> {
    if (!this.databaseEnabled) {
      throw new BadRequestException('Database functionality is disabled');
    }

    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findOneBy({
        email: userDto.email,
      });
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      const user = new UserEntity();
      user.userName = userDto.userName;
      user.email = userDto.email;
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(userDto.password, salt);

      const savedUser = await this.userRepository.save(user);
      delete savedUser.password;
      return savedUser;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<{
    items: UserEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    console.log('Fetching all users...');
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const skip = (page - 1) * limit;

      const [users, total] = await this.userRepository.findAndCount({
        skip,
        take: limit,
        order: {
          createdAt: 'DESC',
        },
      });

      const items = users.map((user) => {
        const userCopy = { ...user };
        delete userCopy.password;
        return userCopy;
      });

      return {
        items,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch users: ' + error.message);
    }
  }

  async findOne(data: Partial<UserEntity>): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOneBy({ email: data.email });
      if (!user) {
        throw new UnauthorizedException(
          'User not found with the provided email',
        );
      }
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Failed to find user: ' + error.message);
    }
  }

  async findById(id: number): Promise<UserEntity> {
    try {
      const user = await this.userRepository.findOneBy({ id });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      delete user.password;

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to find user with ID ${id}: ${error.message}`,
      );
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserEntity> {
    try {
      const user = await this.findById(id);

      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await this.userRepository.findOneBy({
          email: updateUserDto.email,
        });
        if (existingUser) {
          throw new BadRequestException('Email is already in use');
        }
      }

      if (updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        updateUserDto.password = await bcrypt.hash(
          updateUserDto.password,
          salt,
        );
      }
      const updatedUser = await this.userRepository.save({
        ...user,
        ...updateUserDto,
      });
      // Remove password from the returned user object
      delete updatedUser.password;
      return updatedUser;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update user with ID ${id}: ${error.message}`,
      );
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const result = await this.userRepository.delete(id);
      if (result.affected === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to delete user with ID ${id}: ${error.message}`,
      );
    }
  }

  async updateRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<void> {
    try {
      // Hash the refresh token before storing
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

      await this.userRepository.update(
        { id: userId },
        { refreshToken: hashedRefreshToken },
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to update refresh token: ${error.message}`,
      );
    }
  }

  async removeRefreshToken(userId: number): Promise<void> {
    try {
      await this.userRepository.update({ id: userId }, { refreshToken: null });
    } catch (error) {
      throw new BadRequestException(
        `Failed to remove refresh token: ${error.message}`,
      );
    }
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
    console.log('Fetching students with filters:', {
      query,
      active,
      course,
      page,
      limit,
    });

    try {
      let filteredStudentIds: number[] | null = null;

      // Step 1: Handle active/inactive filtering
      if (active === 'active' || active === 'inactive') {
        const pendingSessions = await this.sessionRepo.find({
          where: { status: 'Pending' },
        });
        const activeStudentIds = [
          ...new Set(pendingSessions.map((session) => session.studentId)),
        ];

        if (active === 'active') {
          filteredStudentIds = activeStudentIds;
          if (activeStudentIds.length === 0) {
            return {
              students: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false,
              },
            };
          }
        } else if (active === 'inactive') {
          filteredStudentIds = activeStudentIds;
        }
      }

      // Step 2: Handle course filtering by course name
      if (course) {
        const courseEntity = await this.courseRepository.findOne({
          where: { title: ILike(`%${course}%`) },
          select: ['id'],
        });

        if (courseEntity) {
          const courseSessions = await this.sessionRepo.find({
            where: { courseId: courseEntity.id },
          });
          const courseStudentIds = [
            ...new Set(courseSessions.map((session) => session.studentId)),
          ];

          if (filteredStudentIds !== null) {
            if (active === 'active') {
              filteredStudentIds = filteredStudentIds.filter((id) =>
                courseStudentIds.includes(id),
              );
            } else if (active === 'inactive') {
              filteredStudentIds = courseStudentIds.filter(
                (id) => !filteredStudentIds.includes(id),
              );
            }
          } else {
            filteredStudentIds = courseStudentIds;
          }
        } else {
          return {
            students: [],
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

      // Step 3: Build where clause for final query
      const where: any = {};

      if (query) {
        where.name = ILike(`%${query}%`);
      }

      if (filteredStudentIds !== null) {
        if (active === 'inactive' && !course) {
          if (filteredStudentIds.length === 0) {
            return {
              students: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false,
              },
            };
          } else {
            where.id = Not(In(filteredStudentIds));
          }
        } else {
          if (filteredStudentIds.length === 0) {
            return {
              students: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                hasNext: false,
                hasPrev: false,
              },
            };
          }
          where.id = In(filteredStudentIds);
        }
      }

      // Calculate pagination
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const totalCount = await this.studentRepository.count({ where });
      const totalPages = Math.ceil(totalCount / limit);

      // Fetch paginated students
      const students = await this.studentRepository.find({
        where,
        order: {
          createdAt: 'DESC',
        },
        select: [
          'id',
          'name',
          'nickname',
          'dob',
          'phone',
          'allergic',
          'doNotEat',
          'adConcent',
          'profilePicture',
        ],
        skip: offset,
        take: limit,
      });

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

  async createTeacher(
    createTeacherDto: CreateTeacherDto,
  ): Promise<TeacherEntity> {
    try {
      const teacher = new TeacherEntity();
      teacher.name = createTeacherDto.name;
      teacher.email = createTeacherDto.email;
      teacher.contactNo = createTeacherDto.contactNo;
      teacher.lineId = createTeacherDto.lineId || '';
      teacher.address = createTeacherDto.address;
      teacher.profilePicture = createTeacherDto.profilePicture || '';

      const savedTeacher = await this.teacherRepository.save(teacher);
      return savedTeacher;
    } catch (error) {
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
          where: { status: 'Pending' },
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

  // Get all parents
  async findAllParents(): Promise<ParentEntity[]> {
    try {
      return await this.parentRepository.find();
    } catch (error) {
      throw new BadRequestException(
        'Failed to fetch parents: ' + error.message,
      );
    }
  }

  async searchParentsByName(
    query?: string,
    child?: string,
    address?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    parents: ParentEntity[];
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

      let filteredParentIds: number[] | null = null;

      // Handle child filtering
      if (child && child.trim() !== 'all') {
        const studentEntity = await this.studentRepository.findOne({
          where: { name: ILike(`%${child}%`) },
          select: ['id'],
        });

        if (studentEntity) {
          const parentChildren = await this.parentStudentRepo.find({
            where: { studentId: studentEntity.id },
          });
          filteredParentIds = parentChildren.map((pc) => pc.parentId);
        } else {
          return {
            parents: [],
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

      if (address && address.trim() !== 'all') {
        where.address = ILike(`%${address}%`);
      }

      if (filteredParentIds !== null) {
        if (filteredParentIds.length === 0) {
          return {
            parents: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
        where.id = In(filteredParentIds);
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const totalCount = await this.parentRepository.count({ where });
      const totalPages = Math.ceil(totalCount / limit);

      // Fetch paginated parents
      const parents = await this.parentRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

      return {
        parents,
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
        'Failed to search parents: ' + error.message,
      );
    }
  }

  async createParent(createParentDto: CreateParentDto): Promise<ParentEntity> {
    try {
      const parent = new ParentEntity();
      parent.name = createParentDto.name;
      parent.email = createParentDto.email;
      parent.contactNo = createParentDto.contactNo;
      parent.lineId = createParentDto.lineId;
      parent.address = createParentDto.address;
      const savedParent = await this.parentRepository.save(parent);
      return savedParent;
    } catch (error) {
      throw new BadRequestException(
        'Failed to create parent: ' + error.message,
      );
    }
  }

  async assignChildrenToParent(
    parentId: number,
    studentIds: number[],
  ): Promise<ParentStudentEntity[]> {
    const assignments = studentIds.map((studentId) => {
      const entry = new ParentStudentEntity();
      entry.parentId = parentId;
      entry.studentId = studentId;
      return entry;
    });

    return this.parentStudentRepo.save(assignments);
  }

  async getChildrenByParentId(parentId: number): Promise<StudentEntity[]> {
    const parentStudents = await this.parentStudentRepo.find({
      where: { parentId },
    });

    if (parentStudents.length === 0) {
      return [];
    }

    const studentIds = parentStudents.map((ps) => ps.studentId);
    return this.studentRepository.find({
      where: { id: In(studentIds) },
    });
  }

  async getParentsByStudentId(studentId: number): Promise<ParentEntity[]> {
    const parentStudents = await this.parentStudentRepo.find({
      where: { studentId },
    });

    if (parentStudents.length === 0) {
      return [];
    }

    const parentIds = parentStudents.map((ps) => ps.parentId);
    return this.parentRepository.find({
      where: { id: In(parentIds) },
    });
  }
}
