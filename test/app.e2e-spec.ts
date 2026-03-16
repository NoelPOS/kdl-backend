import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app/app.module';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_ENABLED = 'false';
    jest.setTimeout(30000);
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should initialize the Nest application', () => {
    expect(app).toBeDefined();
    expect(app.getHttpServer()).toBeDefined();
  });
});
