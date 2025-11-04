import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { LineMessagingService } from './services/line-messaging.service';
import { RichMenuService } from './services/rich-menu.service';
import { ParentVerificationService } from './services/parent-verification.service';
import { ScheduleNotificationService } from './services/schedule-notification.service';
import { WebhookEvent, MessageEvent, PostbackEvent, FollowEvent } from '@line/bot-sdk';

/**
 * LINE Webhook Controller
 * Handles all incoming events from LINE platform:
 * - Follow events (user adds bot)
 * - Message events (user sends message)
 * - Postback events (user clicks flex message buttons)
 * 
 * Security: Validates LINE signature for all requests
 */
@ApiTags('LINE Webhook')
@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(
    private readonly lineMessagingService: LineMessagingService,
    private readonly richMenuService: RichMenuService,
    private readonly parentVerificationService: ParentVerificationService,
    private readonly scheduleNotificationService: ScheduleNotificationService,
  ) {}

  /**
   * Main webhook endpoint
   * Receives all events from LINE platform
   */
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'LINE webhook endpoint for receiving events' })
  @ApiBody({
    description: 'LINE webhook events',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Event processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-line-signature') signature: string,
  ): Promise<{ success: boolean }> {
    // Validate LINE signature for security
    const isValid = this.lineMessagingService.validateSignature(
      JSON.stringify(body),
      signature,
    );

    if (!isValid) {
      this.logger.error('Invalid LINE signature');
      throw new BadRequestException('Invalid signature');
    }

    const events: WebhookEvent[] = body.events;

    // Process each event
    for (const event of events) {
      try {
        await this.handleEvent(event);
      } catch (error) {
        this.logger.error(`Error handling event: ${error.message}`, error.stack);
      }
    }

    return { success: true };
  }

  /**
   * Route events to appropriate handlers
   */
  private async handleEvent(event: WebhookEvent): Promise<void> {
    this.logger.log(`Received event type: ${event.type}`);

    switch (event.type) {
      case 'follow':
        await this.handleFollowEvent(event);
        break;
      case 'message':
        await this.handleMessageEvent(event);
        break;
      case 'postback':
        await this.handlePostbackEvent(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle follow event (user adds bot)
   * - Send welcome message
   * - Assign unverified rich menu
   */
  private async handleFollowEvent(event: FollowEvent): Promise<void> {
    const userId = event.source.userId;
    this.logger.log(`User ${userId} followed the bot`);

    // Check if user is already verified
    const isVerified = await this.parentVerificationService.isVerified(userId);

    if (isVerified) {
      // Already verified, assign verified menu
      await this.richMenuService.assignVerifiedMenu(userId);
      await this.lineMessagingService.sendTextMessage(
        userId,
        'Welcome back! 👋\n\nYour account is already verified. Tap "KDL Portal" below to access your dashboard.',
      );
    } else {
      // New user, assign unverified menu
      await this.richMenuService.assignUnverifiedMenu(userId);
      await this.lineMessagingService.sendWelcomeMessage(userId);
    }
  }

  /**
   * Handle text message events
   * For now, just acknowledge with help message
   */
  private async handleMessageEvent(event: MessageEvent): Promise<void> {
    if (event.message.type !== 'text') {
      return;
    }

    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const messageText = event.message.text.toLowerCase();

    // Simple command handling
    if (messageText.includes('help') || messageText.includes('ช่วย')) {
      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: '📚 KDL Bot Help\n\n' +
                '• Tap "KDL Portal" to view schedules\n' +
                '• You will receive notifications 3 days before each class\n' +
                '• Use the Confirm/Reschedule buttons in notifications\n\n' +
                'Need assistance? Contact KDL office.',
        },
      ]);
    } else {
      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: 'Thank you for your message! 😊\n\n' +
                'For schedules and notifications, please tap "KDL Portal" below.\n\n' +
                'Type "help" for more information.',
        },
      ]);
    }
  }

  /**
   * Handle postback events (button clicks)
   * - Confirm schedule
   * - Reschedule request
   */
  private async handlePostbackEvent(event: PostbackEvent): Promise<void> {
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const data = event.postback.data;

    this.logger.log(`Postback data: ${data}`);

    // Parse postback data (format: "action=confirm&scheduleId=123")
    const params = new URLSearchParams(data);
    const action = params.get('action');
    const scheduleId = parseInt(params.get('scheduleId'), 10);

    if (!action || !scheduleId) {
      this.logger.error('Invalid postback data');
      return;
    }

    // Verify parent ownership before processing
    const isAuthorized = await this.scheduleNotificationService.validateParentOwnership(
      userId,
      scheduleId,
    );

    if (!isAuthorized) {
      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: '❌ Unauthorized\n\nThis schedule does not belong to you.',
        },
      ]);
      return;
    }

    // Handle different actions
    switch (action) {
      case 'confirm':
        await this.handleConfirmSchedule(userId, scheduleId, replyToken);
        break;
      case 'reschedule':
        await this.handleRescheduleRequest(userId, scheduleId, replyToken);
        break;
      default:
        this.logger.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle schedule confirmation
   */
  private async handleConfirmSchedule(
    userId: string,
    scheduleId: number,
    replyToken: string,
  ): Promise<void> {
    try {
      const result = await this.scheduleNotificationService.confirmSchedule(
        userId,
        scheduleId,
      );

      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: `✅ Confirmed!\n\n${result.studentName}'s class on ${result.date} is confirmed.\n\nSee you at ${result.startTime} in ${result.room}! 🎓`,
        },
      ]);
    } catch (error) {
      this.logger.error(`Failed to confirm schedule: ${error.message}`);
      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: '❌ Failed to confirm schedule. Please try again or contact KDL office.',
        },
      ]);
    }
  }

  /**
   * Handle reschedule request
   */
  private async handleRescheduleRequest(
    userId: string,
    scheduleId: number,
    replyToken: string,
  ): Promise<void> {
    try {
      const result = await this.scheduleNotificationService.requestReschedule(
        userId,
        scheduleId,
      );

      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: `📝 Reschedule Request Submitted\n\n` +
                `We've received your request to reschedule ${result.studentName}'s class on ${result.date}.\n\n` +
                `Our team will contact you within 24 hours to confirm the new schedule.\n\n` +
                `Thank you! 🙏`,
        },
      ]);
    } catch (error) {
      this.logger.error(`Failed to request reschedule: ${error.message}`);
      await this.lineMessagingService.replyMessage(replyToken, [
        {
          type: 'text',
          text: '❌ Failed to submit reschedule request. Please contact KDL office directly.',
        },
      ]);
    }
  }
}
