import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  ParseIntPipe,
  NotFoundException,
  Query,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Session } from './entities/session.entity';
import { PaginatedSessionResponseDto } from './dto/paginated-session-response.dto';
import { StudentSessionFilterDto } from './dto/student-session-filter.dto';
import { TeacherSessionFilterDto } from './dto/teacher-session-filter.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { PaginatedSessionOverviewResponseDto } from './dto/paginated-session-overview-response.dto';
import { AddCoursePlusDto } from './dto/add-course-plus.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.REGISTRAR)
@ApiBearerAuth('JWT-auth')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiTags('Sessions')
  @Post()
  @ApiOperation({ summary: 'Create a new session' })
  @ApiBody({ type: CreateSessionDto })
  @ApiResponse({
    status: 201,
    description: 'The session has been successfully created.',
    type: Session,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionService.create(createSessionDto);
  }

  @ApiTags('Sessions')
  @Post('course-plus')
  @ApiOperation({ summary: 'Add course plus to an existing session' })
  @ApiBody({ type: AddCoursePlusDto })
  @ApiResponse({
    status: 201,
    description: 'Course plus has been successfully added.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  addCoursePlus(@Body() addCoursePlusDto: AddCoursePlusDto) {
    return this.sessionService.addCoursePlus(addCoursePlusDto);
  }

  @ApiTags('Sessions')
  @Get()
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiResponse({
    status: 200,
    description: 'List of all sessions',
    type: [Session],
  })
  findAll() {
    return this.sessionService.findAll();
  }

  @ApiTags('Sessions')
  @Get('overview/:studentId')
  @ApiOperation({ summary: "Get a student's session overview" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({ status: 200, description: "The student's session overview" })
  getStudentSessionOverview(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.sessionService.getSessionOverviewByStudentId(studentId);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId')
  @ApiOperation({ summary: "Get all of a student's sessions" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: "The student's sessions",
    type: [Session],
  })
  getStudentSessions(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.sessionService.getStudentSessions(studentId);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId/filtered')
  @ApiOperation({ summary: 'Get filtered student sessions with pagination' })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiQuery({
    name: 'courseName',
    required: false,
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (completed/Pending)',
  })
  @ApiQuery({
    name: 'payment',
    required: false,
    description: 'Filter by payment status (paid/unpaid)',
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
    description: 'Filtered student sessions with pagination',
    type: PaginatedSessionOverviewResponseDto,
  })
  getStudentSessionsFiltered(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() filterDto: StudentSessionFilterDto,
  ) {
    return this.sessionService.getStudentSessionsFiltered(studentId, filterDto);
  }

  @ApiTags('Sessions')
  @Get('teacher/:teacherId/filtered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get filtered teacher sessions with pagination' })
  @ApiParam({ name: 'teacherId', type: 'number' })
  @ApiQuery({
    name: 'courseName',
    required: false,
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (completed/wip)',
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
    description: 'Filtered teacher sessions with pagination',
    type: PaginatedSessionOverviewResponseDto,
  })
  getTeacherSessionsFiltered(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query() filterDto: TeacherSessionFilterDto,
  ) {
    return this.sessionService.getTeacherSessionsFiltered(teacherId, filterDto);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId/course/:courseId')
  @ApiOperation({ summary: "Get a student's session by course" })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiParam({ name: 'courseId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: "The student's session for a specific course",
    type: Session,
  })
  getStudentSessionByCourse(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.sessionService.getStudentSessionByCourse(studentId, courseId);
  }

  @ApiTags('Sessions')
  @Get('student/:studentId/course/:courseId/has-wip')
  @ApiOperation({
    summary:
      'Check if student has a WIP (Work In Progress) session for a specific course',
    description:
      'Returns true if the student already has a session with WIP status for the given course, false otherwise. This prevents creating duplicate WIP sessions for the same course.',
  })
  @ApiParam({ name: 'studentId', type: 'number', description: 'Student ID' })
  @ApiParam({ name: 'courseId', type: 'number', description: 'Course ID' })
  @ApiResponse({
    status: 200,
    description: 'Boolean indicating if student has WIP session for the course',
    schema: {
      type: 'object',
      properties: {
        hasWipSession: {
          type: 'boolean',
          description:
            'True if student has WIP session for the course, false otherwise',
          example: true,
        },
      },
    },
  })
  async checkStudentHasWipSession(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    const hasWipSession = await this.sessionService.checkStudentHasWipSession(
      studentId,
      courseId,
    );
    return { hasWipSession };
  }

  @ApiTags('Sessions')
  @Get('package/:packageId')
  @ApiOperation({ summary: 'Get sessions created from a specific package' })
  @ApiParam({ name: 'packageId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Sessions created from the specified package',
    type: [Session],
  })
  getSessionsByPackage(@Param('packageId', ParseIntPipe) packageId: number) {
    return this.sessionService.getSessionsByPackage(packageId);
  }

  @ApiTags('Sessions')
  @Get('pending-invoice')
  @ApiOperation({
    summary: 'Get sessions pending invoice with filtering and pagination',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (YYYY-MM-DD format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by end date (YYYY-MM-DD format)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (pending/completed)',
  })
  @ApiQuery({
    name: 'course',
    required: false,
    description: 'Filter by course name',
  })
  @ApiQuery({
    name: 'teacher',
    required: false,
    description: 'Filter by teacher name',
  })
  @ApiQuery({
    name: 'student',
    required: false,
    description: 'Filter by student name',
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
  @ApiQuery({
    name: 'transactionType',
    required: false,
    description: 'Filter by transaction type: course, courseplus, or all',
    enum: ['course', 'courseplus', 'all'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of sessions pending invoice with pagination',
    type: PaginatedSessionResponseDto,
  })
  getPendingSessionsForInvoice(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('course') course?: string,
    @Query('teacher') teacher?: string,
    @Query('student') student?: string,
    @Query('transactionType') transactionType?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.sessionService.getPendingSessionsForInvoice(
      startDate,
      endDate,
      status,
      course,
      teacher,
      student,
      transactionType,
      page,
      limit,
    );
  }

  @ApiTags('Sessions')
  @Get('pending-invoice/:sessionId')
  @ApiOperation({ summary: 'Get a specific session pending invoice' })
  @ApiParam({ name: 'sessionId' })
  @ApiResponse({
    status: 200,
    description: 'The session pending invoice',
    type: Session,
  })
  getSpecificPendingSessionsForInvoice(
    @Param('sessionId') sessionId: number | string,
  ) {
    return this.sessionService.getSpecificPendingSessionsForInvoice(sessionId);
  }

  @ApiTags('Sessions')
  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'The found session', type: Session })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const session = await this.sessionService.findOne(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return session;
  }

  @ApiTags('Sessions')
  @Put(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateSessionDto })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully updated.',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updateSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    const updatedSession = await this.sessionService.update(
      id,
      updateSessionDto,
    );
    if (!updatedSession) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return { success: true };
  }

  @ApiTags('Sessions')
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update session status and other attributes',
    description:
      'Update session status, payment, and invoiceDone attributes. Used by frontend for unified session status updates.',
  })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    description: 'Status update payload with support for multiple attributes',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'New status for the session',
          example: 'completed',
        },
        payment: {
          type: 'string',
          description: 'New payment status for the session',
          example: 'paid',
        },
        invoiceDone: {
          type: 'boolean',
          description: 'Whether invoice is done for the session',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully updated.',
    type: Session,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateData: { status?: string; payment?: string; invoiceDone?: boolean },
  ) {
    const updatedSession = await this.sessionService.update(id, updateData);
    if (!updatedSession) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return updatedSession;
  }

  @ApiTags('Sessions')
  @Patch(':id/payment')
  @ApiOperation({ summary: 'Update session payment status' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    description: 'Payment status update payload',
    schema: {
      type: 'object',
      properties: {
        payment: {
          type: 'string',
          description: 'New payment status for the session',
          example: 'paid',
          enum: ['paid', 'unpaid'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'The session payment status has been successfully updated.',
    type: Session,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    const updatedSession = await this.sessionService.update(id, {
      payment: status,
    });
    if (!updatedSession) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return updatedSession;
  }

  @ApiTags('Sessions')
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a session and update related schedules' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully cancelled.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        updatedSchedules: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async cancelSession(@Param('id', ParseIntPipe) id: number) {
    const result = await this.sessionService.cancelSession(id);
    if (!result) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return result;
  }

  @ApiTags('Sessions')
  @Post('feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: 'Submit teacher feedback for a session' })
  @ApiBody({ type: SubmitFeedbackDto })
  @ApiResponse({
    status: 200,
    description: 'Feedback has been successfully submitted.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        updatedSchedules: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  async submitFeedback(@Body() submitFeedbackDto: SubmitFeedbackDto) {
    return this.sessionService.submitFeedback(submitFeedbackDto);
  }

  @ApiTags('Sessions')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a session' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sessionService.remove(id);
  }
}
