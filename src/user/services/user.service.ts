import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { ILike, Repository, UpdateResult } from 'typeorm';
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
      const { page = 1, pageSize = 10 } = paginationDto;
      const skip = (page - 1) * pageSize;

      const [users, total] = await this.userRepository.findAndCount({
        skip,
        take: pageSize,
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
        pageSize,
        totalPages: Math.ceil(total / pageSize),
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

  async findAllStudents(): Promise<{
    students: StudentEntity[];
    total?: number;
  }> {
    console.log('Fetching all students...');
    try {
      const page = 1; // Default to page 1
      const pageSize = 10; // Default page size
      const skip = (page - 1) * pageSize;

      const [students, total] = await this.studentRepository.findAndCount({
        skip,
        take: pageSize,
        order: {
          createdAt: 'DESC',
        },
        // Select only necessary fields
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
      });

      return {
        students,
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
}
