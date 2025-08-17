import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { VerifyFeedbackDto } from './dto/verify-feedback.dto';
import { FeedbackFilterDto } from './dto/feedback-filter.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Schedule } from './entities/schedule.entity';
import { CheckScheduleConflictDto } from './dto/check-schedule-conflict.dto';
import { CheckConflictBatchDto } from './dto/check-schedule-conflict-bulk.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GetUser } from '../common/decorators';

@ApiTags('Schedules')
@Controller('schedules')
@ApiBearerAuth('JWT-auth')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiBody({ type: CreateScheduleDto })
  @ApiResponse({
    status: 201,
    description: 'The schedule has been successfully created.',
    type: Schedule,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  create(@Body() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.create(createScheduleDto);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Create multiple class schedules' })
  @ApiBody({ type: [CreateScheduleDto] })
  @ApiResponse({ status: 201, description: 'Schedules created' })
  createBulkSchedules(@Body() dto: CreateScheduleDto[]) {
    return this.scheduleService.createBulkSchedules(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiResponse({
    status: 200,
    description: 'List of all schedules',
    type: [Schedule],
  })
  findAll() {
    return this.scheduleService.getAllSchedules();
  }

  @Get('filter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Get schedules within a date range' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'studentName', required: false, type: String })
  @ApiQuery({ name: 'teacherName', required: false, type: String })
  @ApiQuery({ name: 'courseName', required: false, type: String })
  @ApiQuery({ name: 'attendanceStatus', required: false, type: String })
  @ApiQuery({ name: 'classStatus', required: false, type: String })
  @ApiQuery({ name: 'room', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated schedules with metadata',
    schema: {
      type: 'object',
      properties: {
        schedules: {
          type: 'array',
          items: { $ref: '#/components/schemas/Schedule' },
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
  getSchedulesByDateRange(@Query() query: FilterScheduleDto) {
    // Map 'limit' to 'pageSize' for backend compatibility
    if (query.page === undefined) query.page = 1;
    if (query.pageSize === undefined && (query as any).limit) {
      query.pageSize = (query as any).limit;
    } else if (query.pageSize === undefined) {
      query.pageSize = 10;
    }

    return this.scheduleService.getSchedulesByRangeAndFilters(query);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: `Get today's schedule grouped by course` })
  @ApiResponse({
    status: 200,
    description: 'Todays schedules',
    type: [Schedule],
  })
  getTodaySchedules(@GetUser() user: any) {
    console.log('user is here pr', user);
    if (user.role === UserRole.TEACHER) {
      return this.scheduleService.getTodaySchedules(user.id);
    }
    return this.scheduleService.getTodaySchedules();
  }

  @Get('teacher/:teacherId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: "Get a teacher's schedules" })
  @ApiParam({ name: 'teacherId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: "The teacher's schedules",
    type: [Schedule],
  })
  getSchedulesForTeacher(@Param('teacherId', ParseIntPipe) teacherId: number) {
    return this.scheduleService.getSchedulesForTeacher(teacherId);
  }

  @Get('session/:sessionId/student/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Get schedules by session and student' })
  @ApiParam({ name: 'sessionId', type: 'number' })
  @ApiParam({ name: 'studentId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Schedules matching session and student',
    type: [Schedule],
  })
  getSchedulesByStudentAndSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.scheduleService.getSchedulesByStudentAndSession(
      sessionId,
      studentId,
    );
  }

  @Get('session/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: 'Get schedules by session' })
  @ApiParam({ name: 'sessionId', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Schedules for the specified session',
    type: [Schedule],
  })
  getSchedulesBySession(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.scheduleService.getSchedulesBySession(sessionId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR, UserRole.TEACHER)
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiResponse({
    status: 200,
    description: 'The schedule has been successfully updated.',
    type: Schedule,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @GetUser() user: any,
  ) {
    return this.scheduleService.updateSchedule(id, updateScheduleDto, user);
  }

  @Patch(':id/verify-feedback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({
    summary: 'Verify and optionally modify teacher feedback',
    description:
      'Admin/Registrar can review, modify, and verify teacher feedback for a schedule',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Schedule ID' })
  @ApiBody({ type: VerifyFeedbackDto })
  @ApiResponse({
    status: 200,
    description: 'Feedback has been verified and updated successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        scheduleId: { type: 'number' },
        updatedFeedback: { type: 'string' },
        verifiedBy: { type: 'string' },
        verifiedAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized to verify feedback',
  })
  verifyFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() verifyFeedbackDto: VerifyFeedbackDto,
    @GetUser() user: any,
  ) {
    return this.scheduleService.verifyFeedback(id, verifyFeedbackDto, user);
  }

  @Get('feedbacks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({
    summary: 'Get filtered feedbacks with pagination',
    description:
      'Get feedbacks with unverified status (verifyFb = false) with filtering and pagination',
  })
  @ApiQuery({ name: 'studentName', required: false, type: String })
  @ApiQuery({ name: 'courseName', required: false, type: String })
  @ApiQuery({ name: 'teacherName', required: false, type: String })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Status filter (all = default)',
    enum: ['all'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Filtered feedbacks with pagination',
    schema: {
      type: 'object',
      properties: {
        feedbacks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              scheduleId: { type: 'string' },
              studentId: { type: 'string' },
              studentName: { type: 'string' },
              studentNickname: { type: 'string' },
              studentProfilePicture: { type: 'string' },
              courseTitle: { type: 'string' },
              teacherName: { type: 'string' },
              feedback: { type: 'string' },
              feedbackDate: { type: 'string' },
              sessionDate: { type: 'string' },
              sessionTime: { type: 'string' },
            },
          },
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
  getFilteredFeedbacks(
    @Query('studentName') studentName?: string,
    @Query('courseName') courseName?: string,
    @Query('teacherName') teacherName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;

    const filterDto: FeedbackFilterDto = {
      studentName,
      courseName,
      teacherName,
      startDate,
      endDate,
      status,
      page,
      limit,
    };
    console.log('filterDto', filterDto);
    return this.scheduleService.getFilteredFeedbacks(filterDto);
  }

  @Get('pending-feedback-verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({
    summary: 'Get schedules with unverified feedback',
    description:
      'Get all schedules that have feedback but are not yet verified by admin/registrar',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'List of schedules with unverified feedback',
    schema: {
      type: 'object',
      properties: {
        schedules: {
          type: 'array',
          items: { $ref: '#/components/schemas/Schedule' },
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
  getPendingFeedbackVerification(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.scheduleService.getSchedulesWithPendingFeedback(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The found schedule',
    type: Schedule,
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const schedule = await this.scheduleService.findOne(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }
    return schedule;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'The schedule has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleService.remove(id);
  }

  @Post('conflict')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Check for room/time conflict' })
  @ApiResponse({ status: 200, description: 'Conflicting schedules (if any)' })
  checkConflict(@Body() dto: CheckScheduleConflictDto) {
    return this.scheduleService.checkConflict(dto);
  }

  @Post('conflicts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({ summary: 'Batch check for schedule conflicts' })
  @ApiBody({ type: CheckConflictBatchDto })
  checkScheduleConflicts(@Body() dto: CheckConflictBatchDto) {
    return this.scheduleService.checkConflicts(dto.schedules);
  }

  @Post('preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiOperation({
    summary:
      'Preview schedules and check for conflicts before final submission',
  })
  @ApiBody({ type: [CreateScheduleDto] })
  @ApiResponse({
    status: 200,
    description: 'Preview of schedules and any conflicts',
  })
  async previewSchedules(@Body() schedules: CreateScheduleDto[]) {
    // Check for conflicts using the existing service method
    const conflicts = await this.scheduleService.checkConflicts(schedules);
    // Return the preview (input) and conflicts
    return {
      preview: schedules,
      conflicts,
    };
  }
}
