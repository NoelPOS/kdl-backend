import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findOne: jest.fn(),
    findById: jest.fn(),
  };
  const teacherService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };
  const resendService = {
    send: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_EXPIRATION') return fallback || '8h';
      return undefined;
    }),
  };
  const tokenStorageService = {
    storeResetToken: jest.fn(),
    verifyResetToken: jest.fn(),
    consumeResetToken: jest.fn(),
  };
  const userRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const teacherRepository = {
    update: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      teacherService as any,
      resendService as any,
      jwtService as any,
      configService as any,
      tokenStorageService as any,
      userRepository as any,
      teacherRepository as any,
    );
  });

  it('TC-AUTH-001: login throws UnauthorizedException for invalid role mapping', async () => {
    usersService.findOne.mockResolvedValue({
      id: 1,
      userName: 'Admin',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      password: 'hashed',
    });

    await expect(
      service.login({
        email: 'admin@test.com',
        password: 'x',
        role: UserRole.REGISTRAR,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('TC-AUTH-002: login throws UnauthorizedException for wrong password', async () => {
    usersService.findOne.mockResolvedValue({
      id: 1,
      userName: 'Admin',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      password: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'admin@test.com',
        password: 'wrong',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('TC-AUTH-003: login success returns user and accessToken', async () => {
    usersService.findOne.mockResolvedValue({
      id: 7,
      userName: 'Registrar A',
      email: 'registrar@test.com',
      role: UserRole.REGISTRAR,
      password: 'hashed',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue('mock-token');

    const result = await service.login({
      email: 'registrar@test.com',
      password: 'ok',
      role: UserRole.REGISTRAR,
    });

    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'mock-token',
        user: expect.objectContaining({
          id: '7',
          email: 'registrar@test.com',
          role: UserRole.REGISTRAR,
        }),
      }),
    );
  });

  it('TC-AUTH-004: register throws when email already exists', async () => {
    userRepository.findOneBy.mockResolvedValue({ id: 1, email: 'exists@test.com' });

    await expect(
      service.register({
        userName: 'Alice',
        email: 'exists@test.com',
        password: 'secret123',
        role: UserRole.REGISTRAR,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
