import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../../../src/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../../src/user/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<UserEntity>;
  const testUser = {
    userName: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
  };
  let hashedPassword: string;

  beforeAll(() => {
    jest.setTimeout(60000);
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_ENABLED = 'true';
    process.env.DB_SYNCHRONIZE = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  });

  beforeAll(async () => {
    // Hash the password
    hashedPassword = await bcrypt.hash(testUser.password, 10);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
  });

  beforeEach(async () => {
    // Clean the user repository
    await userRepository.clear();
    // Create test user
    await userRepository.save({
      ...testUser,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /auth/login', () => {
    it('should return JWT token when login is successful', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          role: UserRole.ADMIN,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return 401 when password is incorrect', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
          role: UserRole.ADMIN,
        })
        .expect(401);
    });

    it('should return 400 when email is not found', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
          role: UserRole.ADMIN,
        })
        .expect(400);
    });
  });
});
