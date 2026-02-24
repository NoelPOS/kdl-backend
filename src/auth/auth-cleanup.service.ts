import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenStorageService } from './services/token-storage.service';

@Injectable()
export class AuthCleanupService {
  constructor(private readonly tokenStorage: TokenStorageService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens(): Promise<void> {
    await this.tokenStorage.deleteExpiredTokens();
  }
}
