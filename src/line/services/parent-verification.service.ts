import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../parent/entities/parent.entity';
import { VerifyParentDto } from '../dto/verify-parent.dto';
import { LineMessagingService } from './line-messaging.service';
import { RichMenuService } from './rich-menu.service';

/**
 * Parent Verification Service
 * Handles the process of linking LINE user IDs to parent accounts
 * 
 * Security Flow:
 * 1. Parent provides email OR phone number
 * 2. System checks if parent exists in database
 * 3. System checks if LINE ID is not already linked
 * 4. Link LINE user ID to parent account
 * 5. Upgrade rich menu to verified state
 * 6. Send success message
 */
@Injectable()
export class ParentVerificationService {
  private readonly logger = new Logger(ParentVerificationService.name);

  constructor(
    @InjectRepository(ParentEntity)
    private readonly parentRepository: Repository<ParentEntity>,
    private readonly lineMessagingService: LineMessagingService,
    private readonly richMenuService: RichMenuService,
  ) {}

  /**
   * Verify parent identity and link LINE user ID
   * 
   * @param dto - Contains lineUserId and either email or contactNo
   * @returns Success message with parent info
   * @throws NotFoundException if parent not found
   * @throws BadRequestException if LINE ID already linked or no credentials provided
   */
  async verifyAndLinkParent(dto: VerifyParentDto): Promise<{
    success: boolean;
    message: string;
    parent: {
      id: number;
      name: string;
      email: string;
    };
  }> {
    // Validate input: at least email or contactNo must be provided
    if (!dto.email && !dto.contactNo) {
      throw new BadRequestException(
        'Please provide either email or phone number',
      );
    }

    // Check if this LINE user ID is already linked to another parent
    const existingParent = await this.parentRepository.findOne({
      where: { lineId: dto.lineUserId },
    });

    if (existingParent) {
      throw new BadRequestException(
        `This LINE account is already linked to ${existingParent.name}. If this is incorrect, please contact KDL office.`,
      );
    }

    // Find parent by email or phone number
    const whereCondition: any = {};
    if (dto.email) {
      whereCondition.email = dto.email;
    }
    if (dto.contactNo) {
      whereCondition.contactNo = dto.contactNo;
    }

    const parents = await this.parentRepository.find({
      where: whereCondition,
    });

    if (parents.length === 0) {
      throw new NotFoundException(
        'No parent account found with the provided information. Please contact KDL office to register.',
      );
    }

    // If multiple parents found (edge case: shared email), let user select
    if (parents.length > 1) {
      this.logger.warn(
        `Multiple parents found for email/phone: ${dto.email || dto.contactNo}`,
      );
      // For now, throw error. TODO: Implement parent selection UI
      throw new BadRequestException(
        'Multiple accounts found. Please contact KDL office for assistance.',
      );
    }

    const parent = parents[0];

    // Check if parent already has a LINE ID linked
    if (parent.lineId && parent.lineId !== dto.lineUserId) {
      throw new BadRequestException(
        `This parent account is already linked to another LINE account. Please contact KDL office if you need to change your LINE account.`,
      );
    }

    // Link LINE user ID to parent
    parent.lineId = dto.lineUserId;
    await this.parentRepository.save(parent);

    this.logger.log(
      `Successfully linked LINE user ${dto.lineUserId} to parent ${parent.id} (${parent.name})`,
    );

    // Upgrade rich menu to verified state
    await this.richMenuService.assignVerifiedMenu(dto.lineUserId);

    // Send success message
    await this.lineMessagingService.sendTextMessage(
      dto.lineUserId,
      `✅ Verification Successful!\n\nWelcome, ${parent.name}!\n\nYour LINE account is now linked. You can now:\n• Receive schedule notifications\n• Confirm or reschedule classes\n• View your children's schedules\n\nTap "KDL Portal" below to get started! 👇`,
    );

    return {
      success: true,
      message: 'Parent account successfully verified and linked',
      parent: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
      },
    };
  }

  /**
   * Get parent by LINE user ID
   * Used by LIFF app to fetch parent profile
   */
  async getParentByLineId(lineUserId: string): Promise<ParentEntity> {
    const parent = await this.parentRepository.findOne({
      where: { lineId: lineUserId },
    });

    if (!parent) {
      throw new NotFoundException(
        'No verified parent found. Please complete verification first.',
      );
    }

    return parent;
  }

  /**
   * Check if LINE user is verified
   */
  async isVerified(lineUserId: string): Promise<boolean> {
    const count = await this.parentRepository.count({
      where: { lineId: lineUserId },
    });
    return count > 0;
  }

  /**
   * Unlink LINE account (admin feature)
   */
  async unlinkLineAccount(parentId: number): Promise<void> {
    const parent = await this.parentRepository.findOne({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    if (!parent.lineId) {
      throw new BadRequestException('Parent has no LINE account linked');
    }

    const lineUserId = parent.lineId;
    parent.lineId = null;
    await this.parentRepository.save(parent);

    // Downgrade to unverified menu
    await this.richMenuService.assignUnverifiedMenu(lineUserId);

    this.logger.log(`Unlinked LINE account from parent ${parentId}`);
  }
}
