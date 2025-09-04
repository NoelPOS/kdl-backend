import { Injectable } from '@nestjs/common';

interface ResetToken {
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenStorageService {
  private tokens = new Map<string, ResetToken>();

  storeResetToken(email: string, role: string, token: string): void {
    const key = `${email}:${role}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Token expires in 15 minutes

    this.tokens.set(key, {
      email,
      role,
      token,
      expiresAt,
    });
  }

  verifyResetToken(email: string, role: string, token: string): boolean {
    const key = `${email}:${role}`;
    const storedToken = this.tokens.get(key);

    if (!storedToken) {
      return false;
    }

    const now = new Date();
    if (now > storedToken.expiresAt) {
      this.tokens.delete(key);
      return false;
    }

    return storedToken.token === token;
  }

  consumeResetToken(email: string, role: string): void {
    const key = `${email}:${role}`;
    this.tokens.delete(key);
  }

  // Clean up expired tokens periodically
  cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [key, token] of this.tokens.entries()) {
      if (now > token.expiresAt) {
        this.tokens.delete(key);
      }
    }
  }
}
