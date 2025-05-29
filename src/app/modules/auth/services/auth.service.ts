import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { v4 as uuid4 } from 'uuid';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import { UserEntity } from '../../user/entities/user.entity';
import { UserLoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { Enable2FAType } from '../types/enable-2fa.type';
import { MoreThan, Repository, UpdateResult } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ResendService } from 'nestjs-resend';
import {
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_TEMPLATE,
} from '../../../../config/emailTemplates';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { Token, TokenType } from '../entities/opt.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UserService,
    private resendService: ResendService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
  ) {}

  async register(
    userDto: RegisterDto,
  ): Promise<UserEntity & { accessToken: string; refreshToken: string }> {
    try {
      // Check if email already exists
      const existingUser = await this.userRepository.findOneBy({
        email: userDto.email,
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      const user = new UserEntity();
      user.userName = userDto.userName;
      user.email = userDto.email;
      user.apiKey = uuid4();
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(userDto.password, salt);

      const savedUser = await this.userRepository.save(user);
      delete savedUser.password;
      const tokens = await this.generateTokens(savedUser);

      // Send verification email
      // Note: The email template is not used in this example, but you can customize it as needed.
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Create a verification token
      const verificationToken = new Token();
      verificationToken.userId = savedUser.id.toString();
      verificationToken.token = otp;
      verificationToken.type = TokenType.VERIFY_EMAIL;
      verificationToken.expireIn = new Date(
        Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      );
      await this.tokenRepository.save(verificationToken);

      // Prepare the verification email
      const emailTemplate = VERIFICATION_EMAIL_TEMPLATE.replace(
        '{{verificationCode}}',
        otp,
      )
        .replace('{{verifyLink}}', '') // TODO User actual frontend route
        .replace('{{name}}', savedUser.userName);

      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: savedUser.email,
        subject: 'Please verify your email',
        html: emailTemplate,
      });

      // Store the refresh token in the database
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        ...savedUser,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, verificationCode } = verifyEmailDto;
    try {
      // Find the user by email
      const user = await this.usersService.findOne({ email });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Check if the verification code matches
      const token = await this.tokenRepository.findOne({
        where: {
          userId: user.id.toString(),
          token: verificationCode,
          type: TokenType.VERIFY_EMAIL,
          expireIn: MoreThan(new Date()),
        },
      });

      if (!token) {
        throw new BadRequestException('Invalid verification code');
      }

      // Mark the user as verified
      user.isVerified = true;
      await this.userRepository.save(user);

      // Optionally, delete the token after successful verification
      await this.tokenRepository.remove(token);

      const emailTemplate = WELCOME_TEMPLATE.replace('{{name}}', user.userName);

      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: user.email,
        subject: 'Welcome to Our Service',
        html: emailTemplate,
      });

      return { message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error(`Email verification failed: ${error.message}`);
      throw new BadRequestException(
        `Email verification failed: ${error.message}`,
      );
    }
  }

  async login(
    loginDTO: UserLoginDto,
  ): Promise<
    | { accessToken: string; refreshToken: string }
    | { validate2FA: string; message: string }
  > {
    try {
      const user = await this.usersService.findOne(loginDTO);

      const passwordMatched = await bcrypt.compare(
        loginDTO.password,
        user.password,
      );

      if (!passwordMatched) {
        throw new UnauthorizedException('Password does not match');
      }

      delete user.password;

      const tokens = await this.generateTokens(user);

      // Store the refresh token in the database
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(`Login failed: ${error.message}`);
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findOne({ email });
      if (!user) {
        throw new BadRequestException('User not found');
      }
      // Generate a reset token
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      const token = new Token();
      token.userId = user.id.toString();
      token.token = resetToken;
      token.type = TokenType.FORGOT_PASSWORD;
      token.expireIn = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await this.tokenRepository.save(token);
      // Send the reset token via email
      const emailTemplate = PASSWORD_RESET_REQUEST_TEMPLATE.replace(
        '{{verificationCode}}',
        resetToken,
      ).replace('{{name}}', user.userName);

      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: user.email,
        subject: 'Password Reset Request',
        html: emailTemplate,
      });
      return { message: 'Password reset code sent to your email' };
    } catch (error) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      throw new BadRequestException(`Forgot password failed: ${error.message}`);
    }
  }

  async resetPassword(
    email: string,
    verificationCode: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findOne({ email });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Find the reset token
      const token = await this.tokenRepository.findOne({
        where: {
          userId: user.id.toString(),
          token: verificationCode,
          type: TokenType.FORGOT_PASSWORD,
          expireIn: MoreThan(new Date()),
        },
      });

      if (!token) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Update the user's password
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(newPassword, salt);
      await this.userRepository.save(user);

      const emailTemplate = PASSWORD_RESET_SUCCESS_TEMPLATE.replace(
        '{{name}}',
        user.userName,
      );
      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: user.email,
        subject: 'Password Reset Successful',
        html: emailTemplate,
      });

      // Optionally, delete the token after successful reset
      await this.tokenRepository.remove(token);

      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error(`Reset password failed: ${error.message}`);
      throw new BadRequestException(`Reset password failed: ${error.message}`);
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const { refreshToken } = refreshTokenDto;

      // Verify the refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Find the user with this refresh token
      const user = await this.usersService.findById(payload.sub);

      // Validate that the refresh token matches what's stored
      if (
        !user ||
        !user.refreshToken ||
        !(await bcrypt.compare(refreshToken, user.refreshToken))
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update the refresh token in the database
      await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      this.logger.error(`Refresh token failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: number): Promise<void> {
    // Clear the refresh token when logging out
    await this.usersService.removeRefreshToken(userId);
  }

  private async generateTokens(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      email: user.email,
      sub: user.id,
      userName: user.userName,
      role: user.role,
    };

    // Generate access token
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
    });

    // Generate refresh token with longer expiration
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async enable2FA(userId: number): Promise<Enable2FAType> {
    try {
      const user = await this.usersService.findById(userId);

      if (user.enable2FA) {
        // If 2FA is already enabled, return the decrypted secret
        return { secret: user.twoFASecret };
      }

      // Generate a new 2FA secret - will be encrypted by the UserService
      const secret = speakeasy.generateSecret();
      await this.usersService.updateSecretKey(user.id, secret.base32);

      return { secret: secret.base32 };
    } catch (error) {
      this.logger.error(`Failed to enable 2FA: ${error.message}`);
      throw new BadRequestException(`Failed to enable 2FA: ${error.message}`);
    }
  }

  async validate2FAToken(
    userId: number,
    token: string,
  ): Promise<{ verified: boolean }> {
    try {
      const user = await this.usersService.findById(userId);

      // The secret is already decrypted in findById
      const verified = speakeasy.totp.verify({
        secret: user.twoFASecret,
        token: token,
        encoding: 'base32',
      });

      return { verified: verified };
    } catch (error) {
      this.logger.error(`Error verifying token: ${error.message}`);
      throw new UnauthorizedException('Error verifying token');
    }
  }

  async validateUserByApiKey(apiKey: string): Promise<UserEntity> {
    return this.usersService.findByApiKey(apiKey);
  }

  async disable2FA(userId: number): Promise<UpdateResult> {
    return this.usersService.disable2FA(userId);
  }

  getEnvVariables() {
    return {
      port: this.configService.get<number>('PORT'),
      nodeEnv: this.configService.get<string>('NODE_ENV'),
    };
  }
}
