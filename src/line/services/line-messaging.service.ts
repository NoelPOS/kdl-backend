import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';
import {
  FlexMessage,
  FlexBubble,
  TextMessage,
  Message,
} from '@line/bot-sdk';

/**
 * LINE Messaging Service
 * Handles all LINE Bot SDK operations including:
 * - Sending flex messages (schedule notifications)
 * - Sending text messages (confirmations, errors)
 * - Managing rich menus (verified vs unverified states)
 * - Validating webhook signatures
 */
@Injectable()
export class LineMessagingService {
  private readonly logger = new Logger(LineMessagingService.name);
  private readonly client: line.Client;
  private readonly channelSecret: string;

  constructor(private readonly configService: ConfigService) {
    const channelAccessToken = this.configService.get<string>(
      'LINE_CHANNEL_ACCESS_TOKEN',
    );
    this.channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET');

    if (!channelAccessToken || !this.channelSecret) {
      this.logger.warn(
        'LINE credentials not configured. LINE features will be disabled.',
      );
      return;
    }

    this.client = new line.Client({
      channelAccessToken,
      channelSecret: this.channelSecret,
    });

    this.logger.log('LINE Messaging Service initialized');
  }

  /**
   * Validate LINE webhook signature for security
   */
  validateSignature(body: string, signature: string): boolean {
    if (!this.channelSecret) {
      return false;
    }
    return line.validateSignature(body, this.channelSecret, signature);
  }

  /**
   * Send a simple text message to a user
   */
  async sendTextMessage(userId: string, text: string): Promise<void> {
    try {
      const message: TextMessage = {
        type: 'text',
        text,
      };
      await this.client.pushMessage(userId, message);
      this.logger.log(`Sent text message to ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to send text message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send welcome message to new users (unverified state)
   */
  async sendWelcomeMessage(userId: string): Promise<void> {
    const liffId = this.configService.get<string>('LINE_LIFF_ID');
    const message: FlexMessage = {
      type: 'flex',
      altText: 'Welcome to KDL Learning Management System',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'Welcome to KDL! 🎓',
              weight: 'bold',
              size: 'xl',
              color: '#1DB446',
            },
            {
              type: 'text',
              text: 'To get started, please verify your identity.',
              wrap: true,
              margin: 'md',
              size: 'sm',
              color: '#666666',
            },
            {
              type: 'separator',
              margin: 'lg',
            },
            {
              type: 'text',
              text: '⚠️ You must be a registered parent to use this bot.',
              wrap: true,
              margin: 'lg',
              size: 'xs',
              color: '#999999',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🔐 Login & Verify',
                uri: `https://liff.line.me/${liffId}/login`,
              },
            },
          ],
        },
      },
    };

    await this.client.pushMessage(userId, message);
    this.logger.log(`Sent welcome message to ${userId}`);
  }

  /**
   * Send schedule notification as two separate messages:
   * 1. Student info card with View Detail button
   * 2. Reminder text with Confirm/Reschedule buttons
   */
  async sendScheduleNotification(
    userId: string,
    scheduleData: {
      scheduleId: number;
      studentName: string;
      courseName: string;
      date: string;
      startTime: string;
      endTime: string;
      room: string;
      teacherName: string;
      studentImage?: string;
      attendedClasses?: number;
      totalClasses?: number;
      cancelledClasses?: number;
    },
  ): Promise<void> {
    const liffId = this.configService.get<string>('LINE_LIFF_ID');

    // Message 1: Student Info Card
    const studentCardBubble: FlexBubble = {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // Student Image (circular)
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'image',
                    url: scheduleData.studentImage || 'https://via.placeholder.com/300x300.png?text=Student',
                    size: 'full',
                    aspectMode: 'cover',
                    aspectRatio: '1:1',
                  },
                ],
                cornerRadius: '100px',
                width: '150px',
                height: '150px',
              },
            ],
            justifyContent: 'center',
            margin: 'md',
          },
          // Student Info
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: scheduleData.studentName,
                weight: 'bold',
                size: 'xl',
                color: '#1a1a1a',
                align: 'center',
              },
              {
                type: 'text',
                text: scheduleData.courseName,
                size: 'md',
                color: '#4a4a4a',
                margin: 'sm',
                wrap: true,
                align: 'center',
              },
              {
                type: 'text',
                text: `Attended ${scheduleData.attendedClasses || 0} out of ${scheduleData.totalClasses || 0} classes`,
                size: 'xs',
                color: '#8a8a8a',
                margin: 'md',
                align: 'center',
              },
              {
                type: 'text',
                text: `Cancelled ${scheduleData.cancelledClasses || 0} class`,
                size: 'xs',
                color: '#8a8a8a',
                margin: 'xs',
                align: 'center',
              },
            ],
            margin: 'md',
          },
        ],
        paddingAll: 'xl',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'View Detail',
              uri: `https://liff.line.me/${liffId}/schedule/${scheduleData.scheduleId}`,
            },
            style: 'primary',
            color: '#17c950',
          },
        ],
        paddingAll: 'md',
      },
      styles: {
        body: {
          backgroundColor: '#ffffff',
        },
      },
    };

    const studentCardMessage: FlexMessage = {
      type: 'flex',
      altText: `${scheduleData.studentName} - ${scheduleData.courseName}`,
      contents: studentCardBubble,
    };

    // Message 2: Reminder with Action Buttons
    const reminderBubble: FlexBubble = {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `This is a reminder that ${scheduleData.studentName} is scheduled to attend the ${scheduleData.courseName} on ${scheduleData.date}, from ${scheduleData.startTime} to ${scheduleData.endTime}. Kindly confirm if he will be available to attend, or if you would prefer to cancel and reschedule.`,
            wrap: true,
            size: 'sm',
            color: '#4a4a4a',
          },
        ],
        paddingAll: 'xl',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'Reschedule',
              data: `action=reschedule&scheduleId=${scheduleData.scheduleId}`,
              displayText: 'Request reschedule',
            },
            style: 'secondary',
            color: '#aaaaaa',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: 'Confirm',
              data: `action=confirm&scheduleId=${scheduleData.scheduleId}`,
              displayText: 'Confirm attendance',
            },
            style: 'primary',
            color: '#17c950',
            flex: 1,
          },
        ],
        spacing: 'sm',
        paddingAll: 'md',
      },
      styles: {
        body: {
          backgroundColor: '#ffffff',
        },
      },
    };

    const reminderMessage: FlexMessage = {
      type: 'flex',
      altText: `Reminder: ${scheduleData.courseName} on ${scheduleData.date}`,
      contents: reminderBubble,
    };

    // Send both messages
    await this.client.pushMessage(userId, [studentCardMessage, reminderMessage]);
    this.logger.log(
      `Sent schedule notification to ${userId} for schedule ${scheduleData.scheduleId}`,
    );
  }

  /**
   * Reply to webhook events
   */
  async replyMessage(replyToken: string, messages: Message[]): Promise<void> {
    try {
      await this.client.replyMessage(replyToken, messages);
      this.logger.log('Replied to message');
    } catch (error) {
      this.logger.error(`Failed to reply message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user profile from LINE
   */
  async getUserProfile(userId: string): Promise<line.Profile> {
    try {
      return await this.client.getProfile(userId);
    } catch (error) {
      this.logger.error(`Failed to get user profile: ${error.message}`);
      throw error;
    }
  }
}
