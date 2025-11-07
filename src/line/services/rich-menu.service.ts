import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

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
   * Uses existing menu IDs from .env or creates new ones if they don't exist
   */
  async initializeRichMenus(): Promise<void> {
    try {
      // Check if menu IDs exist in environment variables
      const envUnverifiedMenuId = this.configService.get<string>('UNVERIFIED_MENU_ID');
      const envVerifiedMenuId = this.configService.get<string>('VERIFIED_MENU_ID');

      if (envUnverifiedMenuId && envVerifiedMenuId) {
        // Use existing menu IDs from .env
        this.unverifiedMenuId = envUnverifiedMenuId;
        this.verifiedMenuId = envVerifiedMenuId;
        this.logger.log(`✅ Using existing rich menus from .env:`);
        this.logger.log(`   Unverified: ${this.unverifiedMenuId}`);
        this.logger.log(`   Verified: ${this.verifiedMenuId}`);
        this.logger.log(`⚠️  Make sure images are uploaded using: npm run upload-rich-menu-images`);
      } else {
        // Create new menus if they don't exist in .env
        this.logger.warn(`⚠️  UNVERIFIED_MENU_ID or VERIFIED_MENU_ID not found in .env`);
        this.logger.log(`🔄 Creating new rich menus...`);
        
        this.unverifiedMenuId = await this.createUnverifiedMenu();
        this.logger.log(`✅ Unverified menu created: ${this.unverifiedMenuId}`);

        this.verifiedMenuId = await this.createVerifiedMenu();
        this.logger.log(`✅ Verified menu created: ${this.verifiedMenuId}`);

        this.logger.warn(`\n⚠️  IMPORTANT: Add these to your .env file:`);
        this.logger.warn(`UNVERIFIED_MENU_ID=${this.unverifiedMenuId}`);
        this.logger.warn(`VERIFIED_MENU_ID=${this.verifiedMenuId}`);
        this.logger.warn(`\nThen run: npm run upload-rich-menu-images\n`);
      }
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
    this.logger.log(`Created unverified menu: ${menuId}`);

    // Note: Image upload disabled - use upload-rich-menu-images.ts script instead
    // This prevents automatic placeholder uploads and lets you use custom images
    this.logger.log(`⚠️  Remember to upload image for menu ${menuId} using the upload script`);

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
    this.logger.log(`Created verified menu: ${menuId}`);

    // Note: Image upload disabled - use upload-rich-menu-images.ts script instead
    // This prevents automatic placeholder uploads and lets you use custom images
    this.logger.log(`⚠️  Remember to upload image for menu ${menuId} using the upload script`);

    return menuId;
  }

  /**
   * Create a simple placeholder image for rich menu
   * Uses a solid color background with text
   * Size: 2500x843px (required by LINE)
   */
  private async createPlaceholderImage(text: string, color: string): Promise<Buffer> {
    // For now, return a simple solid color PNG
    // In production, you should use a proper image library like 'canvas' or upload real images
    // This is a minimal 2500x843 PNG with solid color
    
    // Download from a placeholder service or create locally
    // For simplicity, we'll use a public placeholder API
    const url = `https://via.placeholder.com/2500x843/${color.replace('#', '')}/${color.replace('#', '')}?text=${encodeURIComponent(text)}`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
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

  /**
   * Upload image to an existing rich menu
   * Useful for updating existing menus or fixing missing images
   */
  async uploadImageToMenu(menuId: string, text: string, color: string = '#10B981'): Promise<void> {
    try {
      this.logger.log(`📤 Uploading image to rich menu ${menuId}...`);
      const imageBuffer = await this.createPlaceholderImage(text, color);
      await this.client.setRichMenuImage(menuId, imageBuffer, 'image/png');
      this.logger.log(`✅ Successfully uploaded image to menu ${menuId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to upload image to menu ${menuId}:`, error);
      throw error;
    }
  }

  /**
   * Fix existing menus by uploading images
   * Call this if menus were created without images
   */
  async fixExistingMenus(): Promise<void> {
    try {
      if (this.unverifiedMenuId) {
        await this.uploadImageToMenu(this.unverifiedMenuId, '🔐 Login to KDL', '#10B981');
      }
      if (this.verifiedMenuId) {
        await this.uploadImageToMenu(this.verifiedMenuId, '📱 My KDL Portal', '#059669');
      }
      this.logger.log(`✅ All menu images uploaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to fix existing menus:`, error);
    }
  }
}
