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
  UseGuards,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StudentEntity } from './entities/student.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @ApiTags('Students')
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR) // Only admins and registrars can create students
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new student' })
  @ApiBody({ type: CreateStudentDto })
  @ApiResponse({
    status: 201,
    description: 'Student has been successfully created',
    type: StudentEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  createStudent(@Body() createStudentDto: CreateStudentDto) {
    return this.studentService.createStudent(createStudentDto);
  }

  @ApiTags('Students')
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR) // Only admins and registrars can view all students
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all students with pagination' })
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
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: 'string',
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'course',
    required: false,
    type: 'string',
    description: 'Filter by course',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated students',
    schema: {
      type: 'object',
      properties: {
        students: {
          type: 'array',
          items: { $ref: '#/components/schemas/StudentEntity' },
        },
        pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            totalCount: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  findAllStudents(
    @Query('query') query?: string,
    @Query('active') active?: string,
    @Query('course') course?: string,
    @Query('courseType') courseType?: 'fixed' | 'check' | 'camp' | 'all' | '',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.studentService.findAllStudents(
      query,
      active,
      course,
      courseType,
      page,
      limit,
    );
  }

  @ApiTags('Students')
  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search students by name, nickname, or id' })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Search query for student name',
  })
  @ApiQuery({
    name: 'nickname',
    required: false,
    description: 'Search query for student nickname',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    type: 'number',
    description: 'Search by student ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns students that match the search query',
    type: [StudentEntity],
  })
  findStudentsBySearch(
    @Query('name') name?: string,
    @Query('nickname') nickname?: string,
    @Query('id') id?: number,
  ) {
    const searchQuery: any = {};
    if (name) searchQuery.name = name;
    if (nickname) searchQuery.nickname = nickname;
    if (id) searchQuery.id = Number(id);

    return this.studentService.searchStudents(searchQuery);
  }

  @ApiTags('Students')
  @Get('parents/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search parents by name for student assignment' })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Search query for parent name',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns parents that match the search query',
  })
  searchParentsByName(@Query('name') name: string) {
    return this.studentService.searchParentsByName(name);
  }

  @ApiTags('Students')
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a student by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Student ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the student object',
    type: StudentEntity,
  })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async findStudentById(@Param('id') id: string) {
    const student = await this.studentService.findStudentById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  @ApiTags('Students')
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a student by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Student ID' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({
    status: 200,
    description: 'Student has been successfully updated',
    type: StudentEntity,
  })
  @ApiResponse({ status: 404, description: 'Student not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async updateStudentById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.studentService.updateStudent(id, updateStudentDto);
  }
}
