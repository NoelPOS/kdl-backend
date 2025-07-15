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
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Schedule } from './entities/schedule.entity';
import { CheckScheduleConflictDto } from './dto/check-schedule-conflict.dto';
import { CheckConflictBatchDto } from './dto/check-schedule-conflict-bulk.dto';
import { FilterScheduleDto } from './dto/filter-schedule.dto';

@ApiTags('Schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
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
  @ApiOperation({ summary: 'Create multiple class schedules' })
  @ApiBody({ type: [CreateScheduleDto] })
  @ApiResponse({ status: 201, description: 'Schedules created' })
  createBulkSchedules(@Body() dto: CreateScheduleDto[]) {
    return this.scheduleService.createBulkSchedules(dto);
  }

  @Get()
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
  @ApiOperation({ summary: `Get today's schedule grouped by course` })
  @ApiResponse({
    status: 200,
    description: 'Todays schedules',
    type: [Schedule],
  })
  getTodaySchedules() {
    return this.scheduleService.getTodaySchedules();
  }

  @Get('teacher/:teacherId')
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

  @Get(':id')
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

  @Patch(':id')
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
  ) {
    return this.scheduleService.updateSchedule(id, updateScheduleDto);
  }

  @Delete(':id')
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
  @ApiOperation({ summary: 'Check for room/time conflict' })
  @ApiResponse({ status: 200, description: 'Conflicting schedules (if any)' })
  checkConflict(@Body() dto: CheckScheduleConflictDto) {
    return this.scheduleService.checkConflict(dto);
  }

  @Post('conflicts')
  @ApiOperation({ summary: 'Batch check for schedule conflicts' })
  @ApiBody({ type: CheckConflictBatchDto })
  checkScheduleConflicts(@Body() dto: CheckConflictBatchDto) {
    return this.scheduleService.checkConflicts(dto.schedules);
  }

  @Post('preview')
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
