import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @GetUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('isRead') isRead?: string, // received as string from query
    @Query('search') search?: string,
  ) {
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationService.findAll(user.id, page, limit, {
      startDate,
      endDate,
      type,
      isRead: isReadBool,
      search,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@GetUser() user: any) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
  ) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@GetUser() user: any) {
    return this.notificationService.markAllAsRead(user.id);
  }
}
