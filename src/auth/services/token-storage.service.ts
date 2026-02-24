import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PasswordResetTokenEntity } from '../entities/password-reset-token.entity';

@Injectable()
export class TokenStorageService {
  constructor(
    @InjectRepository(PasswordResetTokenEntity)
    private readonly tokenRepo: Repository<PasswordResetTokenEntity>,
  ) {}

  async storeResetToken(
    email: string,
    role: string,
    token: string,
  ): Promise<void> {
    // Invalidate any existing unused tokens for this email + role
    await this.tokenRepo.update({ email, role, used: false }, { used: true });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.tokenRepo.save({ email, role, token, used: false, expiresAt });
  }

  async verifyResetToken(
    email: string,
    role: string,
    token: string,
  ): Promise<boolean> {
    const record = await this.tokenRepo.findOne({
      where: { email, role, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!record || record.expiresAt < new Date()) {
      return false;
    }

    return record.token === token;
  }

  async consumeResetToken(email: string, role: string): Promise<void> {
    await this.tokenRepo.update({ email, role, used: false }, { used: true });
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.tokenRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}
