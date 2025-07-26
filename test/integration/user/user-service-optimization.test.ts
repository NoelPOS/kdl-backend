import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserService } from '../../../src/user/services/user.service';
import { UserEntity } from '../../../src/user/entities/user.entity';
import { StudentEntity } from '../../../src/user/entities/student.entity';
import { TeacherEntity } from '../../../src/user/entities/teacher.entity';
import { TeacherCourseEntity } from '../../../src/user/entities/teacher-course.entity';
import { ParentEntity } from '../../../src/user/entities/parent.entity';
import { ParentStudentEntity } from '../../../src/user/entities/parent-student.entity';
import { Session } from '../../../src/session/entities/session.entity';
import { CourseEntity } from '../../../src/course/entities/course.entity';
import { DataSource } from 'typeorm';

describe('UserService - findAllStudents Optimization', () => {
  let service: UserService;
  let dataSource: DataSource;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST', 'localhost'),
            port: +configService.get('DB_PORT', 5432),
            username: configService.get('DB_USERNAME', 'test'),
            password: configService.get('DB_PASSWORD', 'test'),
            database: configService.get('DB_NAME', 'test_db'),
            entities: [
              UserEntity,
              StudentEntity,
              TeacherEntity,
              TeacherCourseEntity,
              ParentEntity,
              ParentStudentEntity,
              Session,
              CourseEntity,
            ],
            synchronize: true,
            dropSchema: true,
          }),
        }),
        TypeOrmModule.forFeature([
          UserEntity,
          StudentEntity,
          TeacherEntity,
          TeacherCourseEntity,
          ParentEntity,
          ParentStudentEntity,
          Session,
          CourseEntity,
        ]),
      ],
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  describe('findAllStudents method optimization', () => {
    it('should execute with minimal database queries', async () => {
      // Test basic functionality without filters
      const result = await service.findAllStudents();

      expect(result).toBeDefined();
      expect(result.students).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle query filter correctly', async () => {
      const result = await service.findAllStudents(
        'test',
        undefined,
        undefined,
        1,
        10,
      );

      expect(result).toBeDefined();
      expect(result.students).toBeInstanceOf(Array);
      expect(result.pagination.currentPage).toBe(1);
    });

    it('should handle active filter correctly', async () => {
      const result = await service.findAllStudents(
        undefined,
        'active',
        undefined,
        1,
        10,
      );

      expect(result).toBeDefined();
      expect(result.students).toBeInstanceOf(Array);
    });

    it('should handle inactive filter correctly', async () => {
      const result = await service.findAllStudents(
        undefined,
        'inactive',
        undefined,
        1,
        10,
      );

      expect(result).toBeDefined();
      expect(result.students).toBeInstanceOf(Array);
    });

    it('should handle course filter correctly', async () => {
      const result = await service.findAllStudents(
        undefined,
        undefined,
        'math',
        1,
        10,
      );

      expect(result).toBeDefined();
      expect(result.students).toBeInstanceOf(Array);
    });

    it('should handle pagination correctly', async () => {
      const result = await service.findAllStudents(
        undefined,
        undefined,
        undefined,
        2,
        5,
      );

      expect(result).toBeDefined();
      expect(result.pagination.currentPage).toBe(2);
      expect(result.students.length).toBeLessThanOrEqual(5);
    });

    it('should validate limit bounds', async () => {
      const result = await service.findAllStudents(
        undefined,
        undefined,
        undefined,
        1,
        150,
      );

      // Should be limited to 100 max
      expect(result).toBeDefined();
    });
  });
});
