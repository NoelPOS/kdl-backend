import * as bcrypt from 'bcrypt';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
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
import { UserRole } from '../../common/enums/user-role.enum';
import { TokenStorageService } from './token-storage.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UserService,
    private teacherService: TeacherService,
    private resendService: ResendService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenStorageService: TokenStorageService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,

    @InjectRepository(TeacherEntity)
    private teacherRepository: Repository<TeacherEntity>,
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
      user.role = userDto.role || UserRole.REGISTRAR; // Use provided role or default to REGISTRAR
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

  async forgotPassword(email: string, role: UserRole): Promise<{ message: string }> {
    try {
      let user: UserEntity | TeacherEntity;
      let userName: string;

      // Find user based on role
      if (role === UserRole.TEACHER) {
        user = await this.teacherService.findByEmail(email);
        userName = (user as TeacherEntity).name;
      } else {
        // For ADMIN and REGISTRAR roles, use UserEntity
        user = await this.usersService.findOne({ email });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        
        // Verify that the user has the correct role
        if (user.role !== role) {
          throw new BadRequestException('Invalid role for this user');
        }
        
        userName = (user as UserEntity).userName;
      }

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Generate a 6-digit reset token
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

      // Store the reset token
      this.tokenStorageService.storeResetToken(email, role, resetToken);

      // Send the reset token via email
      const emailTemplate = PASSWORD_RESET_REQUEST_TEMPLATE.replace(
        '{{verificationCode}}',
        resetToken,
      ).replace('{{name}}', userName);

      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: email,
        subject: 'Password Reset Request',
        html: emailTemplate,
      });

      return { message: 'Password reset code sent to your email' };
    } catch (error) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Forgot password failed: ${error.message}`);
    }
  }

  async verifyResetToken(
    token: string,
    email: string,
    role: UserRole,
  ): Promise<{ message: string }> {
    try {
      const isValid = this.tokenStorageService.verifyResetToken(email, role, token);
      
      if (!isValid) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      return { message: 'Token verified successfully' };
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Token verification failed: ${error.message}`);
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
    email: string,
    role: UserRole,
  ): Promise<{ message: string }> {
    try {
      // Verify the token first
      const isValid = this.tokenStorageService.verifyResetToken(email, role, token);
      
      if (!isValid) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      let user: UserEntity | TeacherEntity;
      let userName: string;

      // Find and update user based on role
      if (role === UserRole.TEACHER) {
        user = await this.teacherService.findByEmail(email);
        userName = (user as TeacherEntity).name;
        
        // Update teacher password
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await this.teacherRepository.update(user.id, { password: hashedPassword });
      } else {
        // For ADMIN and REGISTRAR roles, use UserEntity
        user = await this.usersService.findOne({ email });
        if (!user) {
          throw new NotFoundException('User not found');
        }
        
        // Verify that the user has the correct role
        if (user.role !== role) {
          throw new BadRequestException('Invalid role for this user');
        }
        
        userName = (user as UserEntity).userName;
        
        // Update user password
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await this.userRepository.update(user.id, { password: hashedPassword });
      }

      // Consume the token so it can't be used again
      this.tokenStorageService.consumeResetToken(email, role);

      // Send success email
      const emailTemplate = PASSWORD_RESET_SUCCESS_TEMPLATE.replace(
        '{{name}}',
        userName,
      );
      
      await this.resendService.send({
        from: this.configService.get<string>('RESEND_FROM_EMAIL'),
        to: email,
        subject: 'Password Reset Successful',
        html: emailTemplate,
      });

      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error(`Reset password failed: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
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
