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
   * Send schedule notification flex message
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
    },
  ): Promise<void> {
    const liffId = this.configService.get<string>('LINE_LIFF_ID');

    const bubble: FlexBubble = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📅 Upcoming Class',
            color: '#ffffff',
            weight: 'bold',
          },
        ],
        backgroundColor: '#1DB446',
        paddingAll: 'md',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: scheduleData.studentName,
            weight: 'bold',
            size: 'lg',
            color: '#1DB446',
          },
          {
            type: 'text',
            text: scheduleData.courseName,
            size: 'md',
            weight: 'bold',
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '📅',
                    size: 'sm',
                    flex: 0,
                  },
                  {
                    type: 'text',
                    text: scheduleData.date,
                    size: 'sm',
                    color: '#666666',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '🕐',
                    size: 'sm',
                    flex: 0,
                  },
                  {
                    type: 'text',
                    text: `${scheduleData.startTime} - ${scheduleData.endTime}`,
                    size: 'sm',
                    color: '#666666',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '📍',
                    size: 'sm',
                    flex: 0,
                  },
                  {
                    type: 'text',
                    text: scheduleData.room,
                    size: 'sm',
                    color: '#666666',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '👨‍🏫',
                    size: 'sm',
                    flex: 0,
                  },
                  {
                    type: 'text',
                    text: scheduleData.teacherName,
                    size: 'sm',
                    color: '#666666',
                    flex: 5,
                  },
                ],
              },
            ],
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
              type: 'postback',
              label: '✅ Confirm',
              data: `action=confirm&scheduleId=${scheduleData.scheduleId}`,
              displayText: 'Confirm attendance',
            },
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '🔄 Reschedule',
              data: `action=reschedule&scheduleId=${scheduleData.scheduleId}`,
              displayText: 'Request reschedule',
            },
          },
          {
            type: 'button',
            style: 'link',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📱 View Details',
              uri: `https://liff.line.me/${liffId}/schedule/${scheduleData.scheduleId}`,
            },
          },
        ],
      },
    };

    const message: FlexMessage = {
      type: 'flex',
      altText: `Upcoming class: ${scheduleData.courseName} on ${scheduleData.date}`,
      contents: bubble,
    };

    await this.client.pushMessage(userId, message);
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
