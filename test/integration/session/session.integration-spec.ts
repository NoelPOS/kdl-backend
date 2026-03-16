import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../../../src/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../../src/user/entities/user.entity';
import { TeacherEntity } from '../../../src/teacher/entities/teacher.entity';
import { StudentEntity } from '../../../src/student/entities/student.entity';
import { CourseEntity } from '../../../src/course/entities/course.entity';
import { ClassOption } from '../../../src/class-option/entities/class-option.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('SessionController (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let userRepository: Repository<UserEntity>;
  let teacherRepository: Repository<TeacherEntity>;
  let studentRepository: Repository<StudentEntity>;
  let courseRepository: Repository<CourseEntity>;
  let classOptionRepository: Repository<ClassOption>;

  let adminUser: UserEntity;
  let teacherUser: TeacherEntity;
  let student: StudentEntity;
  let course: CourseEntity;
  let classOptionStandard: ClassOption;
  let classOptionPackage: ClassOption;
  let adminToken: string;
  let teacherToken: string;

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    userRepository = moduleFixture.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    teacherRepository = moduleFixture.get<Repository<TeacherEntity>>(
      getRepositoryToken(TeacherEntity),
    );
    studentRepository = moduleFixture.get<Repository<StudentEntity>>(
      getRepositoryToken(StudentEntity),
    );
    courseRepository = moduleFixture.get<Repository<CourseEntity>>(
      getRepositoryToken(CourseEntity),
    );
    classOptionRepository = moduleFixture.get<Repository<ClassOption>>(
      getRepositoryToken(ClassOption),
    );
  });

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE
        "receipts",
        "invoice_items",
        "invoices",
        "schedules",
        "course_plus",
        "sessions",
        "document_counters",
        "teacher_absences",
        "teacher_courses",
        "teacher_availability",
        "class_options",
        "courses",
        "students",
        "teachers",
        "notifications",
        "password_reset_tokens",
        "users"
      RESTART IDENTITY CASCADE;
    `);

    adminUser = await userRepository.save({
      userName: 'admin',
      email: 'admin-session@test.com',
      password: 'unused-hash',
      role: UserRole.ADMIN,
      profilePicture: '',
      profileKey: null,
    });

    teacherUser = await teacherRepository.save({
      name: 'Teacher Session',
      email: 'teacher-session@test.com',
      password: 'unused-hash',
      role: UserRole.TEACHER,
      contactNo: '0800000001',
      lineId: 'U-session-teacher',
      address: 'Bangkok',
      profilePicture: '',
      profileKey: null,
      teacherType: 'full-time',
      workingDays: ['Monday', 'Tuesday'],
    });

    student = await studentRepository.save({
      studentId: '2026030001',
      name: 'Session Student',
      nickname: 'SesStu',
      nationalId: null,
      dob: '2015-01-01',
      gender: 'female',
      school: 'KDL School',
      allergic: [],
      doNotEat: [],
      adConcent: false,
      phone: '0811111111',
      profilePicture: '',
      profileKey: null,
    });

    course = await courseRepository.save({
      title: 'Math Integration',
      description: 'Math course for integration tests',
      ageRange: '7-12',
      medium: 'EN',
    });

    classOptionStandard = await classOptionRepository.save({
      classMode: 'private-standard',
      classLimit: 1,
      tuitionFee: 1000,
      effectiveStartDate: new Date('2026-01-01'),
      effectiveEndDate: null,
      optionType: 'check',
    });

    await dataSource.query(`
      INSERT INTO "class_options"
        ("id", "classMode", "classLimit", "tuitionFee", "effectiveStartDate", "effectiveEndDate", "optionType")
      VALUES
        (11, 'package-special', 10, 5000, '2026-01-01', NULL, 'check');
    `);

    classOptionPackage = await classOptionRepository.findOneByOrFail({ id: 11 });

    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.userName,
      role: UserRole.ADMIN,
    });

    teacherToken = jwtService.sign({
      sub: teacherUser.id,
      email: teacherUser.email,
      name: teacherUser.name,
      role: UserRole.TEACHER,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /sessions', () => {
    it('should create a standard session with invoiceDone=false and packageGroupId=null', async () => {
      const payload = {
        studentId: student.id,
        courseId: course.id,
        classOptionId: classOptionStandard.id,
        teacherId: teacherUser.id,
        classCancel: 0,
        payment: 'unpaid',
        status: 'wip',
      };

      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)
        .expect((res) => {
          expect(res.body.studentId).toBe(student.id);
          expect(res.body.courseId).toBe(course.id);
          expect(res.body.invoiceDone).toBe(false);
          expect(res.body.packageGroupId).toBeNull();
        });
    });

    it('should set packageGroupId when classOptionId is 11', async () => {
      const payload = {
        studentId: student.id,
        courseId: course.id,
        classOptionId: 11,
        teacherId: teacherUser.id,
        classCancel: 0,
        payment: 'unpaid',
        status: 'wip',
      };

      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)
        .expect((res) => {
          expect(res.body.packageGroupId).not.toBeNull();
          expect(typeof res.body.packageGroupId).toBe('number');
        });
    });

    it('should return 403 for teacher role', async () => {
      const payload = {
        studentId: student.id,
        courseId: course.id,
        classOptionId: classOptionStandard.id,
        classCancel: 0,
        payment: 'unpaid',
        status: 'wip',
      };

      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(payload)
        .expect(403);
    });

    it('should return 401 without auth token', async () => {
      const payload = {
        studentId: student.id,
        courseId: course.id,
        classOptionId: classOptionStandard.id,
        classCancel: 0,
        payment: 'unpaid',
        status: 'wip',
      };

      await request(app.getHttpServer())
        .post('/sessions')
        .send(payload)
        .expect(401);
    });
  });

  describe('GET /sessions/student/:studentId/course/:courseId/has-wip', () => {
    it('should return hasWipSession=true after creating a wip session', async () => {
      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: student.id,
          courseId: course.id,
          classOptionId: classOptionStandard.id,
          teacherId: teacherUser.id,
          classCancel: 0,
          payment: 'unpaid',
          status: 'wip',
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/sessions/student/${student.id}/course/${course.id}/has-wip`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ hasWipSession: true });
        });
    });
  });
});
