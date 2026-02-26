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
  BadRequestException,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { ParentService } from '../parent/parent.service';
import { SessionService } from '../session/session.service';
import { ScheduleService } from '../schedule/schedule.service';
import { InvoiceService } from '../invoice/invoice.service';
import { LineMessagingService } from './services/line-messaging.service';

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
 * - GET /parent-portal/:id/invoices - Get parent's invoices
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
    private readonly invoiceService: InvoiceService,
    private readonly lineMessagingService: LineMessagingService,
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
   * Get all schedules for a student (for LIFF calendar "All Schedules" view)
   */
  @Get('students/:studentId/schedules')
  @ApiOperation({ summary: 'Get all schedules for a student for LIFF app' })
  @ApiParam({
    name: 'studentId',
    type: Number,
    description: 'Student ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all schedules for student',
  })
  async getStudentAllSchedules(
    @Param('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.scheduleService.getSchedulesByStudent(studentId);
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
    @Body() body: { lineUserId?: string },
  ) {
    // Update attendance to confirmed
    const result = await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'confirmed',
    });

    // Send LINE push message to parent if lineUserId provided
    if (body?.lineUserId) {
      try {
        const schedule = await this.scheduleService.findOne(scheduleId);
        const roomRaw = schedule?.room;
        const room = roomRaw && roomRaw !== '-' ? roomRaw : null;
        const dateStr = schedule?.date
          ? new Date(schedule.date).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })
          : '';
        const locationText = room ? ` in ${room}` : '';
        await this.lineMessagingService.pushMessages(body.lineUserId, [
          {
            type: 'text',
            text: `✅ Confirmed!\n\n${schedule?.student?.name ?? 'Your child'}'s class on ${dateStr} is confirmed.\n\nSee you at ${schedule?.startTime}${locationText}! 🎓`,
          },
        ]);
      } catch (e) {
        // Non-fatal: log but don't fail the HTTP response
      }
    }

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
    @Body() body: { lineUserId?: string },
  ) {
    // Fetch schedule before updating (need details for the push message)
    const schedule = await this.scheduleService.findOne(scheduleId);

    // Update attendance to cancelled - this will trigger:
    // 1. Removal of conflicts
    // 2. Creation of replacement schedule
    const result = await this.scheduleService.updateSchedule(scheduleId, {
      attendance: 'cancelled',
    });

    // Send LINE rich flex push message to parent if lineUserId provided
    if (body?.lineUserId && schedule) {
      try {
        const dateStr = schedule.date
          ? new Date(schedule.date).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })
          : '';
        const richMessage = this.lineMessagingService.buildRescheduleSuccessFlexMessage({
          studentName: schedule?.student?.name ?? 'Your child',
          date: dateStr,
        });
        await this.lineMessagingService.pushMessages(body.lineUserId, [richMessage]);
      } catch (e) {
        // Non-fatal: log but don't fail the HTTP response
      }
    }

    return {
      success: true,
      message: 'Schedule cancelled and replacement schedule created. Our team will contact you to arrange a new time.',
      schedule: result,
    };
  }
  /**
   * Unlink LINE account (Logout)
   */
  @Post('unlink')
  @ApiOperation({ summary: 'Unlink LINE account from parent (Logout)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        lineUserId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully unlinked',
  })
  async unlinkLineAccount(@Body('lineUserId') lineUserId: string) {
    // Get parent by LINE ID to get their ID
    const parent = await this.parentVerificationService.getParentByLineId(lineUserId);
    
    // Unlink logic is in service
    await this.parentVerificationService.unlinkLineAccount(parent.id);
    
    return {
      success: true,
      message: 'Account unlinked successfully',
    };
  }

  /**
   * Change parent password
   */
  @Post('change-password')
  @ApiOperation({ summary: 'Change parent password' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(@Body() dto: ChangePasswordDto) {
    // 1. Get parent by LINE ID
    const parent = await this.parentVerificationService.getParentByLineId(dto.lineUserId);

    // 2. Verify current password
    // For now, we trust the LIFF context or if they provide current password?
    // User requested: "Enter Current Password (To confirm it's really them)"
    
    if (dto.currentPassword) {
      const isMatch = await bcrypt.compare(dto.currentPassword, parent.password);
      if (!isMatch) {
         throw new BadRequestException('Current password does not match');
      }
    } else {
       // If no current password provided, maybe we should require it?
       // Let's require it for security.
       throw new BadRequestException('Current password is required');
    }

    // 3. Change password
    await this.parentVerificationService.changePassword(parent.id, dto.newPassword);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Get invoices for parent's students
   */
  @Get(':parentId/invoices')
  @ApiOperation({ summary: 'Get invoices for parent students' })
  @ApiParam({
    name: 'parentId',
    type: Number,
    description: 'Parent ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
  })
  async getParentInvoices(
    @Param('parentId', ParseIntPipe) parentId: number,
  ) {
    // 1. Get all students linked to this parent
    const childrenResponse = await this.parentService.getParentChildren(parentId);
    const children = childrenResponse.children; // Access the children array from paginated response
    
    if (!children || children.length === 0) {
      return [];
    }

    const studentIds = children.map(child => child.studentId);

    // 2. Get invoices for these students
    return this.invoiceService.findByStudentIds(studentIds);
  }
}
