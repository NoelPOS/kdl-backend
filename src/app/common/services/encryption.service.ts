import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16; // For AES, this is always 16

  constructor(private configService: ConfigService) {
    // Create a key from the JWT secret to avoid storing additional secrets
    // In production, you should use a dedicated encryption key
    const secret = this.configService.get<string>('JWT_SECRET');
    this.key = crypto.scryptSync(secret, 'salt', 32); // Generate a 32 byte key
  }

  /**
   * Encrypts data using AES-256-CBC
   * @param text - Plain text data to encrypt
   * @returns Encrypted data as Base64 string with IV prefixed
   */
  encrypt(text: string): string {
    if (!text) return null;

    try {
      // Generate a new IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher with key and IV
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the data
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Prefix the IV to the encrypted data
      const ivString = iv.toString('base64');

      // Return IV + encrypted data
      return `${ivString}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error.message);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts data using AES-256-CBC
   * @param encryptedText - Encrypted data as Base64 string with IV prefixed
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return null;

    try {
      // Split the IV and encrypted text
      const [ivString, encrypted] = encryptedText.split(':');

      if (!ivString || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }

      // Convert IV from Base64 to Buffer
      const iv = Buffer.from(ivString, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Failed to decrypt data');
    }
  }
}
