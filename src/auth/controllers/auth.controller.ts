import {
  Controller,
  Post,
  Body,
  HttpStatus,
  UseGuards,
  Get,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserEntity } from '../../user/entities/user.entity';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyResetTokenDto } from '../dto/verify-reset-token.dto';
import { TokenDto } from '../dto/token.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registration successful, verification email sent.',
    type: UserEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or email already exists.',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User login successful.',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set HttpOnly cookie for security (only in same-origin environments like EC2)
    // Skip cookies on Vercel cross-origin deployments (use Authorization headers instead)
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    const useCookies = !isVercel; // Use cookies only when NOT on Vercel

    if (useCookies) {
      response.cookie('accessToken', result.accessToken, {
        httpOnly: true, // Cannot be accessed by JavaScript
        secure: isProduction, // HTTPS only in production
        sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-domain, 'lax' for same-domain
        maxAge: 8 * 60 * 60 * 1000, // 8 hours (match JWT expiration)
        path: '/',
      });
    }

    // Always return token in response body for header-based auth (used on Vercel)
    return {
      user: result.user,
      accessToken: result.accessToken,
      useCookies, // Let frontend know if cookies are being used
    };
  }

  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Email address not found.',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email, forgotPasswordDto.role);
  }

  @Post('verify-reset-token')
  @Public()
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiBody({ type: VerifyResetTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token verified successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token.',
  })
  async verifyResetToken(@Body() verifyResetTokenDto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(
      verifyResetTokenDto.token,
      verifyResetTokenDto.email,
      verifyResetTokenDto.role,
    );
  }

  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Reset user password with a verification code' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid reset token or password.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      resetPasswordDto.email,
      resetPasswordDto.role,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User logged out successfully.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  async logout(@Res({ passthrough: true }) response: Response) {
    // Clear the HttpOnly cookie if it exists (EC2 environment)
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    const useCookies = !isVercel;

    if (useCookies) {
      const isProduction = process.env.NODE_ENV === 'production';
      response.clearCookie('accessToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
      });
    }

    await this.authService.logout();
    return { message: 'Logout successful', useCookies };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user information.',
  })
  async getCurrentUser(@GetUser() user: any) {
    return this.authService.getCurrentUser(user.id, user.role);
  }

  // Example protected endpoints with role-based access
  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Admin only endpoint' })
  async adminOnly() {
    return { message: 'This endpoint is only accessible by admins' };
  }

  @Get('teacher-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Teacher only endpoint' })
  async teacherOnly() {
    return { message: 'This endpoint is only accessible by teachers' };
  }

  @Get('admin-registrar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.REGISTRAR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Admin and Registrar only endpoint' })
  async adminRegistrarOnly() {
    return { message: 'This endpoint is accessible by admins and registrars' };
  }
}
