import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  ParseIntPipe,
  NotFoundException,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { AssignCoursesToTeacherDto } from './dto/assign-course-teacher.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TeacherEntity } from './entities/teacher.entity';
import { CourseEntity } from '../course/entities/course.entity';
import { PaginatedTeacherResponseDto } from './dto/paginated-teacher-response.dto';
import { PaginatedTeacherCoursesResponseDto } from './dto/paginated-teacher-courses-response.dto';

@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @ApiTags('Teachers')
  @Post()
  @ApiOperation({ summary: 'Create a new teacher' })
  @ApiBody({ type: CreateTeacherDto })
  @ApiResponse({
    status: 201,
    description: 'Teacher has been successfully created',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  createTeacher(@Body() createTeacherDto: CreateTeacherDto) {
    return this.teacherService.createTeacher(createTeacherDto);
  }

  @ApiTags('Teachers')
  @Get('name/:name')
  @ApiOperation({ summary: 'Get teacher by name' })
  @ApiParam({ name: 'name', required: true, description: 'Teacher name' })
  @ApiResponse({
    status: 200,
    description: 'Teacher found',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  async getTeacherByName(@Param('name') name: string) {
    const teacher = await this.teacherService.findTeacherByName(name);
    if (!teacher) {
      throw new NotFoundException(`Teacher with name ${name} not found`);
    }
    return teacher;
  }

  @ApiTags('Teacher-Course Relationships')
  @Get(':teacherId/courses')
  @ApiOperation({
    summary: 'Get teacher courses with filtering and pagination',
  })
  @ApiParam({
    name: 'teacherId',
    type: Number,
    description: 'ID of the teacher',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query for filtering courses by name',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 12)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of teacher courses with filtering',
    type: PaginatedTeacherCoursesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  getTeacherCourses(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query('query') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number = 12,
  ) {
    return this.teacherService.getTeacherCourses(teacherId, query, page, limit);
  }

  @ApiTags('Teachers')
  @Post(':teacherId/courses')
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
    return this.teacherService.assignCoursesToTeacher(teacherId, dto.courseIds);
  }

  @ApiTags('Teachers')
  @Get('course/:courseId')
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
    return this.teacherService.getTeachersByCourseId(courseId);
  }

  @ApiTags('Teachers')
  @Get()
  @ApiOperation({ summary: 'Get all teachers with pagination and filtering' })
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query for teacher name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: 'string',
    description: 'Filter by status (active/inactive)',
  })
  @ApiQuery({
    name: 'course',
    required: false,
    type: 'string',
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated teachers with filtering',
    type: PaginatedTeacherResponseDto,
  })
  findAllTeachers(
    @Query('query') query?: string,
    @Query('status') status?: string,
    @Query('course') course?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.teacherService.findAllTeachers(
      query,
      status,
      course,
      page,
      limit,
    );
  }

  @ApiTags('Teachers')
  @Get('search')
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
    return this.teacherService.searchTeachersByName(name);
  }

  @ApiTags('Teachers')
  @Get(':id')
  @ApiOperation({ summary: 'Get a teacher by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Teacher ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the teacher object',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  async findTeacherById(@Param('id', ParseIntPipe) id: number) {
    const teacher = await this.teacherService.findTeacherById(id);
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }
    return teacher;
  }

  @ApiTags('Teachers')
  @Put(':id')
  @ApiOperation({ summary: 'Update a teacher by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Teacher ID' })
  @ApiBody({ type: UpdateTeacherDto })
  @ApiResponse({
    status: 200,
    description: 'Teacher has been successfully updated',
    type: TeacherEntity,
  })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async updateTeacherById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    const teacher = await this.teacherService.updateTeacher(
      id,
      updateTeacherDto,
    );
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }
    return teacher;
  }
}
