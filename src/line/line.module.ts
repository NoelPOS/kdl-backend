import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

// Controllers
import { LineController } from './line.controller';
import { ParentPortalController } from './parent-portal.controller';

// Services
import { LineMessagingService } from './services/line-messaging.service';
import { RichMenuService } from './services/rich-menu.service';
import { ParentVerificationService } from './services/parent-verification.service';
import { ScheduleNotificationService } from './services/schedule-notification.service';

// Entities
import { ParentEntity } from '../parent/entities/parent.entity';
import { ParentStudentEntity } from '../parent/entities/parent-student.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { Session } from '../session/entities/session.entity';

// External modules
import { ParentModule } from '../parent/parent.module';
import { SessionModule } from '../session/session.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { InvoiceModule } from '../invoice/invoice.module';

/**
 * LINE Integration Module
 * 
 * Provides:
 * - LINE Bot messaging (push messages, flex messages)
 * - Rich menu management (verified vs unverified states)
 * - Parent verification and LINE account linking
 * - Schedule notifications (cron job runs daily at 9 AM)
 * - Webhook handling (follow events, postback events)
 * - Parent Portal API for LIFF app
 * 
 * Dependencies:
 * - @line/bot-sdk (LINE Bot SDK)
 * - @nestjs/schedule (Cron jobs)
 * 
 * Environment variables required:
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - LINE_LIFF_ID
 */
@Module({
  imports: [
    // Import schedule module for cron jobs
    NestScheduleModule.forRoot(),
    
    // TypeORM entities
    TypeOrmModule.forFeature([
      ParentEntity,
      ParentStudentEntity,
      Schedule,
      Session,
    ]),
    
    // External modules
    ParentModule,
    SessionModule,
    ScheduleModule,
    InvoiceModule,
  ],
  controllers: [
    LineController,
    ParentPortalController,
  ],
  providers: [
    LineMessagingService,
    RichMenuService,
    ParentVerificationService,
    ScheduleNotificationService,
  ],
  exports: [
    LineMessagingService,
    RichMenuService,
    ParentVerificationService,
    ScheduleNotificationService,
  ],
})
export class LineModule implements OnModuleInit {
  constructor(private readonly richMenuService: RichMenuService) {}

  /**
   * Initialize rich menus when module starts
   * This creates the unverified and verified rich menus
   * 
   * Note: Menu images must be uploaded manually via LINE Developers Console
   * or you can use the LINE Bot SDK to upload images programmatically
   */
  async onModuleInit() {
    // Initialize rich menus (commented out for now to avoid errors on first run)
    // Uncomment after you've set up LINE credentials
    await this.richMenuService.initializeRichMenus();
  }
}
