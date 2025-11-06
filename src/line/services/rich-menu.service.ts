import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';

/**
 * Rich Menu Service
 * Manages LINE Rich Menus (the persistent menu at bottom of chat)
 * 
 * Two menu states:
 * 1. Unverified Menu - Only shows "Login" button
 * 2. Verified Menu - Shows "My Portal" button to access LIFF app
 */
@Injectable()
export class RichMenuService {
  private readonly logger = new Logger(RichMenuService.name);
  private readonly client: line.Client;
  private unverifiedMenuId: string;
  private verifiedMenuId: string;

  constructor(private readonly configService: ConfigService) {
    const channelAccessToken = this.configService.get<string>(
      'LINE_CHANNEL_ACCESS_TOKEN',
    );
    const channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET');

    if (!channelAccessToken || !channelSecret) {
      this.logger.warn('LINE credentials not configured.');
      return;
    }

    this.client = new line.Client({
      channelAccessToken,
      channelSecret,
    });

    this.logger.log('Rich Menu Service initialized');
  }

  /**
   * Initialize rich menus on application startup
   * Creates both unverified and verified menus if they don't exist
   */
  async initializeRichMenus(): Promise<void> {
    try {
      // Create unverified menu
      this.unverifiedMenuId = await this.createUnverifiedMenu();
      this.logger.log(`Unverified menu created: ${this.unverifiedMenuId}`);

      // Create verified menu
      this.verifiedMenuId = await this.createVerifiedMenu();
      this.logger.log(`Verified menu created: ${this.verifiedMenuId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize rich menus: ${error.message}`);
    }
  }

  /**
   * Create rich menu for unverified users (only Login button)
   */
  private async createUnverifiedMenu(): Promise<string> {
    const liffId = this.configService.get<string>('LINE_LIFF_ID');

    const richMenu: line.RichMenu = {
      size: {
        width: 2500,
        height: 843,
      },
      selected: true,
      name: 'Unverified Parent Menu',
      chatBarText: 'Please Login',
      areas: [
        {
          bounds: {
            x: 0,
            y: 0,
            width: 2500,
            height: 843,
          },
          action: {
            type: 'uri',
            label: 'Login',
            uri: `https://liff.line.me/${liffId}/verify`,
          },
        },
      ],
    };

    const menuId = await this.client.createRichMenu(richMenu);

    // Upload image for unverified menu
    // Note: You'll need to create a simple image with "🔐 Login" text
    // For now, we'll skip the image upload - you can add it later via LINE Console
    this.logger.log('Unverified menu image should be uploaded via LINE Console');

    return menuId;
  }

  /**
   * Create rich menu for verified users (My Portal button)
   */
  private async createVerifiedMenu(): Promise<string> {
    const liffId = this.configService.get<string>('LINE_LIFF_ID');

    const richMenu: line.RichMenu = {
      size: {
        width: 2500,
        height: 843,
      },
      selected: true,
      name: 'Verified Parent Menu',
      chatBarText: 'KDL Portal',
      areas: [
        {
          bounds: {
            x: 0,
            y: 0,
            width: 2500,
            height: 843,
          },
          action: {
            type: 'uri',
            label: 'My Portal',
            uri: `https://liff.line.me/${liffId}/children`,
          },
        },
      ],
    };

    const menuId = await this.client.createRichMenu(richMenu);

    // Upload image for verified menu
    // Note: You'll need to create an image with "📱 My Portal" text
    this.logger.log('Verified menu image should be uploaded via LINE Console');

    return menuId;
  }

  /**
   * Assign unverified menu to a user
   */
  async assignUnverifiedMenu(userId: string): Promise<void> {
    if (!this.unverifiedMenuId) {
      this.logger.warn('Unverified menu not initialized');
      return;
    }

    try {
      await this.client.linkRichMenuToUser(userId, this.unverifiedMenuId);
      this.logger.log(`Assigned unverified menu to user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to assign unverified menu: ${error.message}`,
      );
    }
  }

  /**
   * Assign verified menu to a user (after successful login)
   */
  async assignVerifiedMenu(userId: string): Promise<void> {
    if (!this.verifiedMenuId) {
      this.logger.error('❌ Verified menu not initialized - cannot upgrade rich menu');
      throw new Error('Verified menu not available');
    }

    try {
      this.logger.log(`🔄 Upgrading rich menu for user ${userId} to verified state...`);
      this.logger.log(`Using verified menu ID: ${this.verifiedMenuId}`);
      
      await this.client.linkRichMenuToUser(userId, this.verifiedMenuId);
      
      this.logger.log(`✅ Successfully assigned verified menu to user ${userId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to assign verified menu to user ${userId}:`, error);
      this.logger.error(`Error details: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      throw error; // Re-throw so the verification service knows it failed
    }
  }

  /**
   * Get current rich menu IDs (for external use)
   */
  getMenuIds(): { unverified: string; verified: string } {
    return {
      unverified: this.unverifiedMenuId,
      verified: this.verifiedMenuId,
    };
  }
}
