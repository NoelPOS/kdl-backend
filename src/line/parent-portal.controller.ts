import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ParentVerificationService } from './services/parent-verification.service';
import { VerifyParentDto } from './dto/verify-parent.dto';
import { ParentService } from '../parent/parent.service';
import { SessionService } from '../session/session.service';
import { ScheduleService } from '../schedule/schedule.service';

/**
 * Parent Portal Controller
 * API endpoints for LINE LIFF app
 * 
 * Endpoints:
 * - POST /parent-portal/verify - Verify and link LINE account
 * - GET /parent-portal/profile - Get parent profile by LINE user ID
 * - GET /parent-portal/:id/children - Get parent's children
 * - GET /parent-portal/students/:id/sessions - Get student's sessions (courses)
 * - GET /parent-portal/sessions/:id/schedules - Get session's schedules
 * 
 * Note: No authentication required - validates LINE user ID instead
 */
@ApiTags('Parent Portal (LIFF)')
@Controller('parent-portal')
export class ParentPortalController {
  constructor(
    private readonly parentVerificationService: ParentVerificationService,
    private readonly parentService: ParentService,
    private readonly sessionService: SessionService,
    private readonly scheduleService: ScheduleService,
  ) {}

  /**
   * Verify parent identity and link LINE account
   * Called from LIFF login page
   */
  @Post('verify')
  @ApiOperation({ summary: 'Verify parent and link LINE account' })
  @ApiBody({ type: VerifyParentDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully verified and linked',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async verifyParent(@Body() dto: VerifyParentDto) {
    return this.parentVerificationService.verifyAndLinkParent(dto);
  }

  /**
   * Get parent profile by LINE user ID
   * Used by LIFF app to identify logged-in parent
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get parent profile by LINE user ID' })
  @ApiQuery({
    name: 'lineUserId',
    required: true,
    description: 'LINE user ID from liff.getProfile()',
  })
  @ApiResponse({
    status: 200,
    description: 'Parent profile',
  })
  @ApiResponse({ status: 404, description: 'Parent not found or not verified' })
  async getProfile(@Query('lineUserId') lineUserId: string) {
    return this.parentVerificationService.getParentByLineId(lineUserId);
  }

  /**
   * Get parent's children with pagination
   * For child selector page in LIFF app
   */
  @Get(':parentId/children')
  @ApiOperation({ summary: 'Get parent children for LIFF app' })
  @ApiParam({
    name: 'parentId',
    type: Number,
    description: 'Parent ID',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    type: 'string',
    description: 'Search query for child name',
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
    description: 'List of children',
  })
  async getChildren(
    @Param('parentId', ParseIntPipe) parentId: number,
    @Query('query') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number = 12,
  ) {
    return this.parentService.getParentChildren(parentId, query, page, limit);
  }

  /**
   * Get student's sessions (courses) for LIFF course list page
   */
  @Get('students/:studentId/sessions')
  @ApiOperation({ summary: 'Get student sessions (courses) for LIFF app' })
  @ApiParam({
    name: 'studentId',
    type: Number,
    description: 'Student ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of sessions/courses',
  })
  async getStudentSessions(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.sessionService.getStudentSessions(studentId);
  }

  /**
   * Get session schedules for LIFF calendar/schedule page
   */
  @Get('sessions/:sessionId/schedules')
  @ApiOperation({ summary: 'Get session schedules for LIFF app' })
  @ApiParam({
    name: 'sessionId',
    type: Number,
    description: 'Session ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of schedules',
  })
  async getSessionSchedules(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.scheduleService.getSchedulesBySession(sessionId);
  }

  /**
   * Get single schedule details for LIFF detail page
   */
  @Get('schedules/:scheduleId')
  @ApiOperation({ summary: 'Get schedule details for LIFF app' })
  @ApiParam({
    name: 'scheduleId',
    type: Number,
    description: 'Schedule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedule details',
  })
  async getScheduleDetail(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.scheduleService.findOne(scheduleId);
  }

  /**
   * Confirm attendance for a schedule
   */
  @Post('schedules/:scheduleId/confirm')
  @ApiOperation({ summary: 'Confirm attendance for a schedule' })
  @ApiParam({
    name: 'scheduleId',
    type: Number,
    description: 'Schedule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance confirmed',
  })
  async confirmSchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    // Update attendance to confirmed
    const result = await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'confirmed',
    });
    
    return {
      success: true,
      message: 'Attendance confirmed successfully',
      schedule: result,
    };
  }

  /**
   * Request reschedule for a schedule
   * This will cancel the schedule and create a replacement schedule
   */
  @Post('schedules/:scheduleId/reschedule')
  @ApiOperation({ summary: 'Request reschedule for a schedule' })
  @ApiParam({
    name: 'scheduleId',
    type: Number,
    description: 'Schedule ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Reschedule requested - schedule cancelled and replacement created',
  })
  async rescheduleSchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    // Update attendance to cancelled - this will trigger:
    // 1. Removal of conflicts
    // 2. Creation of replacement schedule
    const result = await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'cancelled',
    });
    
    return {
      success: true,
      message: 'Schedule cancelled and replacement schedule created. Our team will contact you to arrange a new time.',
      schedule: result,
    };
  }
}
