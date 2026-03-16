import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../../../src/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../../src/user/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('UserController (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<UserEntity>;
  let jwtService: JwtService;
  const testUser = {
    userName: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
  };
  let hashedPassword: string;
  let authToken: string;
  let userId: number;

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
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(async () => {
    // Clean the user repository
    await userRepository.clear();
    // Create test user
    const user = await userRepository.save({
      ...testUser,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });
    userId = user.id;

    // Generate a JWT token for authorization
    const payload = {
      email: user.email,
      sub: user.id,
      userName: user.userName,
      role: UserRole.ADMIN,
    };
    authToken = jwtService.sign(payload);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /users/profile', () => {
    it('should return user profile when authenticated', async () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(userId);
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.name).toBe(testUser.userName);
          expect(res.body.password).toBeUndefined();
        });
    });

    it('should return 401 when not authenticated', async () => {
      return request(app.getHttpServer()).get('/users/profile').expect(401);
    });
  });

  describe('PUT /users/profile', () => {
    it('should update user profile when authenticated', async () => {
      const updatedProfile = {
        userName: 'updateduser',
      };

      return request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedProfile)
        .expect(200)
        .expect((res) => {
          expect(res.body.userName).toBe(updatedProfile.userName);
          expect(res.body.email).toBe(testUser.email);
        });
    });
  });
});
