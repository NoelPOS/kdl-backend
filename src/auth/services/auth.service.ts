import * as bcrypt from 'bcrypt';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { TeacherService } from '../../teacher/teacher.service';
import { UserEntity } from '../../user/entities/user.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { MoreThan, Repository } from 'typeorm';
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
} from '../../config/emailTemplates';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { Token, TokenType } from '../entities/opt.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UserService,
    private teacherService: TeacherService,
    private resendService: ResendService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @InjectRepository(TeacherEntity)
    private teacherRepository: Repository<TeacherEntity>,

    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
  ) {}

  async register(
    userDto: RegisterDto,
  ): Promise<UserEntity & { accessToken: string }> {
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
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(userDto.password, salt);
      const savedUser = await this.userRepository.save(user);
      delete savedUser.password;
      const accessToken = await this.generateAccessToken(savedUser);

      return {
        ...savedUser,
        accessToken: accessToken,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }

  // Email verification removed - not needed

  async login(loginDTO: LoginDto): Promise<{
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
    accessToken: string;
  }> {
    try {
      let user: UserEntity | TeacherEntity;
      let passwordMatched: boolean;

      // Determine which entity to authenticate based on role
      if (loginDTO.role === UserRole.TEACHER) {
        console.log('Authenticating teacher:', loginDTO.email);
        user = await this.teacherService.findByEmail(loginDTO.email);
        passwordMatched = await bcrypt.compare(
          loginDTO.password,
          user.password,
        );
      } else {
        // For ADMIN and REGISTRAR roles, use UserEntity
        user = await this.usersService.findOne({ email: loginDTO.email });

        // Verify that the user has the correct role
        if (user.role !== loginDTO.role) {
          throw new UnauthorizedException('Invalid role for this user');
        }

        passwordMatched = await bcrypt.compare(
          loginDTO.password,
          user.password,
        );
      }

      if (!passwordMatched) {
        this.logger.warn(`Login failed for user: ${loginDTO.email}`);
        throw new UnauthorizedException('Password does not match');
      }

      delete user.password;

      const accessToken = await this.generateAccessToken(user, loginDTO.role);

      console.log('returning user and accessToken', {
        user: {
          id: user.id.toString(),
          name: (user as TeacherEntity).name || (user as UserEntity).userName,
          email: user.email,
          role: loginDTO.role,
        },
        accessToken: accessToken,
      });

      return {
        user: {
          id: user.id.toString(),
          name: (user as TeacherEntity).name || (user as UserEntity).userName,
          email: user.email,
          role: loginDTO.role,
        },
        accessToken: accessToken,
      };
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

  // Refresh token feature removed

  async logout(): Promise<void> {
    // Simple logout - client should discard the token
    return;
  }

  async getCurrentUser(
    userId: number,
    role: UserRole,
  ): Promise<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
  }> {
    let user: UserEntity | TeacherEntity;

    if (role === UserRole.TEACHER) {
      user = await this.teacherService.findById(userId);
    } else {
      user = await this.usersService.findById(userId);
    }

    return {
      id: user.id.toString(),
      name: (user as TeacherEntity).name || (user as UserEntity).userName,
      email: user.email,
      role: role,
    };
  }

  private async generateAccessToken(
    user: UserEntity | TeacherEntity,
    role?: UserRole,
  ): Promise<string> {
    const userRole = role || (user as UserEntity).role || UserRole.TEACHER;

    const payload = {
      email: user.email,
      sub: user.id,
      name: (user as TeacherEntity).name || (user as UserEntity).userName,
      role: userRole,
    };

    // Generate access token
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '8h'),
    });

    return accessToken;
  }
}
