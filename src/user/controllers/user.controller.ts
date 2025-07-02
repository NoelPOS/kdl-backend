import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserEntity } from '../entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateStudentDto } from '../dto/create-student.dto';
import { CreateTeacherDto } from '../dto/create-teacher.dto';
import { AssignCoursesToTeacherDto } from '../dto/assign-course-teacher.dto';
import { StudentEntity } from '../entities/student.entity';
import { TeacherEntity } from '../entities/teacher.entity';
import { CourseEntity } from '../../course/entities/course.entity';
import { ParentEntity } from '../entities/parent.entity';
import { CreateParentDto } from '../dto/create-parent.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // =================================================================================================
  // Health Check
  // =================================================================================================
  @ApiTags('Health Check')
  @Get('health')
  @ApiOperation({ summary: 'Check if the user service is healthy' })
  @ApiResponse({
    status: 200,
    description: 'User service is healthy',
  })
  healthCheck() {
    return { status: 'User service is healthy' };
  }

  // =================================================================================================
  // Students
  // =================================================================================================
  @ApiTags('Students')
  @Post('students')
  @ApiOperation({ summary: 'Create a new student' })
  @ApiBody({ type: CreateStudentDto })
  @ApiResponse({
    status: 201,
    description: 'Student has been successfully created',
    type: StudentEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createStudent(@Body() createStudentDto: CreateStudentDto) {
    return this.userService.createStudent(createStudentDto);
  }

  @ApiTags('Students')
  @Get('students')
  @ApiOperation({ summary: 'Get all students' })
  @ApiResponse({
    status: 200,
    description: 'Returns all students',
    type: [StudentEntity],
  })
  findAllStudents() {
    return this.userService.findAllStudents();
  }

  @ApiTags('Students')
  @Get('students/search')
  @ApiOperation({ summary: 'Search students by name' })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Search query for student name',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns students that match the search query',
    type: [StudentEntity],
  })
  findStudentsBySearch(@Query('name') query?: string) {
    return this.userService.searchStudents({ name: query });
  }

  @ApiTags('Students')
  @Get('students/active')
  @ApiOperation({
    summary:
      'Get all active students (students with at least one pending session)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all active students',
    type: [StudentEntity],
  })
  findActiveStudents() {
    return this.userService.findActiveStudents();
  }

  @ApiTags('Students')
  @Get('students/inactive')
  @ApiOperation({
    summary: 'Get all inactive students (students with no pending session)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all inactive students',
    type: [StudentEntity],
  })
  findInactiveStudents() {
    return this.userService.findInactiveStudents();
  }

  @ApiTags('Students')
  @Get('students/:id')
  @ApiOperation({ summary: 'Get a student by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Student ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the student object',
    type: StudentEntity,
  })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async findStudentById(@Param('id') id: string) {
    const student = await this.userService.findStudentById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  // =================================================================================================
  // Teachers
  // =================================================================================================
  @ApiTags('Teachers')
  @Post('teachers')
  @ApiOperation({ summary: 'Create a new teacher' })
  @ApiBody({ type: CreateTeacherDto })
  @ApiResponse({
    status: 201,
    description: 'Teacher has been successfully created',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  createTeacher(@Body() createTeacherDto: CreateTeacherDto) {
    return this.userService.createTeacher(createTeacherDto);
  }

  @ApiTags('Teachers')
  @Get('teachers/name/:name')
  @ApiOperation({ summary: 'Get teacher by name' })
  @ApiParam({ name: 'name', required: true, description: 'Teacher name' })
  @ApiResponse({
    status: 200,
    description: 'Teacher found',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  async getTeacherByName(@Param('name') name: string) {
    const teacher = await this.userService.findTeacherByName(name);
    if (!teacher) {
      throw new NotFoundException(`Teacher with name ${name} not found`);
    }
    return teacher;
  }

  @ApiTags('Teachers')
  @Get('teachers/:teacherId/courses')
  @ApiOperation({ summary: 'Get all courses assigned to a teacher' })
  @ApiParam({
    name: 'teacherId',
    type: Number,
    description: 'ID of the teacher',
  })
  @ApiResponse({
    status: 200,
    description: 'List of courses assigned to the teacher',
    type: [CourseEntity],
  })
  getCoursesByTeacher(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.userService.getCoursesByTeacherId(teacherId);
  }

  @ApiTags('Teachers')
  @Post('teachers/:teacherId/courses')
  @ApiOperation({ summary: 'Assign courses to a teacher' })
  @ApiParam({
    name: 'teacherId',
    type: Number,
    description: 'ID of the teacher',
  })
  @ApiBody({ type: AssignCoursesToTeacherDto })
  @ApiResponse({
    status: 201,
    description: 'Courses successfully assigned',
    type: TeacherEntity,
  })
  assignCoursesToTeacher(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Body() dto: AssignCoursesToTeacherDto,
  ) {
    return this.userService.assignCoursesToTeacher(teacherId, dto.courseIds);
  }

  @ApiTags('Teachers')
  @Get('teachers/course/:courseId')
  @ApiOperation({ summary: 'Get all teachers assigned to a course' })
  @ApiParam({
    name: 'courseId',
    type: Number,
    description: 'ID of the course',
  })
  @ApiResponse({
    status: 200,
    description: 'List of teachers assigned to the course',
    type: [TeacherEntity],
  })
  getTeachersByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.userService.getTeachersByCourseId(courseId);
  }

  @ApiTags('Teachers')
  @Get('teachers')
  @ApiOperation({ summary: 'Get all teachers' })
  @ApiResponse({
    status: 200,
    description: 'Returns all teachers',
    type: [TeacherEntity],
  })
  findAllTeachers() {
    return this.userService.findAllTeachers();
  }

  @ApiTags('Teachers')
  @Get('teachers/search')
  @ApiOperation({ summary: 'Search teachers by name' })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Search query for teacher name',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns teachers that match the search query',
    type: [TeacherEntity],
  })
  searchTeachersByName(@Query('name') name: string) {
    return this.userService.searchTeachersByName(name);
  }

  // =================================================================================================
  // Parents
  // =================================================================================================
  @ApiTags('Parents')
  @Get('parents')
  @ApiOperation({ summary: 'Get all parents' })
  @ApiResponse({
    status: 200,
    description: 'Returns all parents',
    type: [ParentEntity],
  })
  findAllParents() {
    return this.userService.findAllParents();
  }

  @ApiTags('Parents')
  @Get('parents/search')
  @ApiOperation({ summary: 'Search parents by name' })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Search query for parent name',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns parents that match the search query',
    type: [ParentEntity],
  })
  searchParentsByName(@Query('name') name: string) {
    return this.userService.searchParentsByName(name);
  }

  @ApiTags('Parents')
  @Post('parents')
  @ApiOperation({ summary: 'Create a new parent' })
  @ApiBody({ type: CreateParentDto })
  @ApiResponse({
    status: 201,
    description: 'Parent has been successfully created',
    type: ParentEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  createParent(@Body() createParentDto: CreateParentDto) {
    console.log(createParentDto);
    return this.userService.createParent(createParentDto);
  }

  // =================================================================================================
  // Users (Authentication Required)
  // =================================================================================================
  @ApiTags('Users')
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiQuery({ type: PaginationDto })
  @ApiResponse({
    status: 200,
    description: 'Returns all users',
    type: [UserEntity],
  })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.userService.findAll(paginationDto);
  }

  @ApiTags('Users')
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user profile',
    type: UserEntity,
  })
  getProfile(@GetUser() user: UserEntity) {
    return user;
  }

  @ApiTags('Users')
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User has been successfully updated',
    type: UserEntity,
  })
  updateProfile(
    @GetUser() user: UserEntity,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(user.id, updateUserDto);
  }

  @ApiTags('Users')
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the user with the specified ID',
    type: UserEntity,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @ApiTags('Users')
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User has been successfully updated',
    type: UserEntity,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @ApiTags('Users')
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
