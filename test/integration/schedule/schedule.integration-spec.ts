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
import { Session } from '../../../src/session/entities/session.entity';
import { Schedule } from '../../../src/schedule/entities/schedule.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('ScheduleController (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let userRepository: Repository<UserEntity>;
  let teacherRepository: Repository<TeacherEntity>;
  let studentRepository: Repository<StudentEntity>;
  let courseRepository: Repository<CourseEntity>;
  let classOptionRepository: Repository<ClassOption>;
  let sessionRepository: Repository<Session>;
  let scheduleRepository: Repository<Schedule>;

  let adminUser: UserEntity;
  let teacherA: TeacherEntity;
  let teacherB: TeacherEntity;
  let studentA: StudentEntity;
  let studentB: StudentEntity;
  let course: CourseEntity;
  let classOption: ClassOption;
  let session: Session;
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
    sessionRepository = moduleFixture.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
    scheduleRepository = moduleFixture.get<Repository<Schedule>>(
      getRepositoryToken(Schedule),
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
      email: 'admin-schedule@test.com',
      password: 'unused-hash',
      role: UserRole.ADMIN,
      profilePicture: '',
      profileKey: null,
    });

    teacherA = await teacherRepository.save({
      name: 'Teacher A',
      email: 'teacher-a@test.com',
      password: 'unused-hash',
      role: UserRole.TEACHER,
      contactNo: '0800000101',
      lineId: 'U-teacher-a',
      address: 'Bangkok',
      profilePicture: '',
      profileKey: null,
      teacherType: 'full-time',
      workingDays: ['Monday'],
    });

    teacherB = await teacherRepository.save({
      name: 'Teacher B',
      email: 'teacher-b@test.com',
      password: 'unused-hash',
      role: UserRole.TEACHER,
      contactNo: '0800000102',
      lineId: 'U-teacher-b',
      address: 'Bangkok',
      profilePicture: '',
      profileKey: null,
      teacherType: 'full-time',
      workingDays: ['Tuesday'],
    });

    studentA = await studentRepository.save({
      studentId: '2026030001',
      name: 'Schedule Student A',
      nickname: 'StuA',
      nationalId: null,
      dob: '2016-01-01',
      gender: 'male',
      school: 'KDL School',
      allergic: [],
      doNotEat: [],
      adConcent: false,
      phone: '0812000001',
      profilePicture: '',
      profileKey: null,
    });

    studentB = await studentRepository.save({
      studentId: '2026030002',
      name: 'Schedule Student B',
      nickname: 'StuB',
      nationalId: null,
      dob: '2016-02-01',
      gender: 'female',
      school: 'KDL School',
      allergic: [],
      doNotEat: [],
      adConcent: false,
      phone: '0812000002',
      profilePicture: '',
      profileKey: null,
    });

    course = await courseRepository.save({
      title: 'Science Integration',
      description: 'Science course for schedule integration tests',
      ageRange: '7-12',
      medium: 'EN',
    });

    classOption = await classOptionRepository.save({
      classMode: 'private',
      classLimit: 1,
      tuitionFee: 1200,
      effectiveStartDate: new Date('2026-01-01'),
      effectiveEndDate: null,
      optionType: 'check',
    });

    session = await sessionRepository.save({
      studentId: studentA.id,
      courseId: course.id,
      classOptionId: classOption.id,
      teacherId: teacherA.id,
      classCancel: 0,
      payment: 'unpaid',
      status: 'wip',
      invoiceDone: false,
      packageGroupId: null,
      comment: null,
      price: null,
    });

    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.userName,
      role: UserRole.ADMIN,
    });

    teacherToken = jwtService.sign({
      sub: teacherA.id,
      email: teacherA.email,
      name: teacherA.name,
      role: UserRole.TEACHER,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /schedules', () => {
    it('should create schedule successfully for admin', async () => {
      const payload = {
        sessionId: session.id,
        courseId: course.id,
        studentId: studentA.id,
        teacherId: teacherA.id,
        date: '2026-03-20',
        startTime: '10:00',
        endTime: '11:00',
        room: 'Room A',
        attendance: 'pending',
        remark: '',
        feedback: '',
        verifyFb: false,
        classNumber: 1,
        warning: '',
      };

      await request(app.getHttpServer())
        .post('/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)
        .expect((res) => {
          expect(res.body.sessionId).toBe(session.id);
          expect(res.body.room).toBe('Room A');
          expect(res.body.attendance).toBe('pending');
        });
    });
  });

  describe('POST /schedules/conflict', () => {
    it('should detect room conflict for overlapping schedules', async () => {
      await scheduleRepository.save({
        sessionId: session.id,
        courseId: course.id,
        studentId: studentA.id,
        teacherId: teacherA.id,
        date: new Date('2026-03-16'),
        startTime: '10:00',
        endTime: '12:00',
        room: 'Room A',
        attendance: 'pending',
        remark: '',
        feedback: '',
        verifyFb: false,
        warning: '',
        classNumber: 1,
      });

      const payload = {
        date: '2026-03-16',
        startTime: '11:00',
        endTime: '13:00',
        room: 'Room A',
        teacherId: teacherA.id,
        studentId: studentB.id,
      };

      await request(app.getHttpServer())
        .post('/schedules/conflict')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201)
        .expect((res) => {
          expect(res.body.conflictType).toContain('room');
        });
    });
  });

  describe('PATCH /schedules/:id', () => {
    it('should reject teacher verifyFb=true update', async () => {
      const existing = await scheduleRepository.save({
        sessionId: session.id,
        courseId: course.id,
        studentId: studentA.id,
        teacherId: teacherA.id,
        date: new Date('2026-03-22'),
        startTime: '09:00',
        endTime: '10:00',
        room: 'Room B',
        attendance: 'pending',
        remark: '',
        feedback: '',
        verifyFb: false,
        warning: '',
        classNumber: 2,
      });

      await request(app.getHttpServer())
        .patch(`/schedules/${existing.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ verifyFb: true })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Teachers cannot verify their own feedback',
          );
        });
    });

    it('should create a replacement schedule when attendance is changed to cancelled', async () => {
      const existing = await scheduleRepository.save({
        sessionId: session.id,
        courseId: course.id,
        studentId: studentA.id,
        teacherId: teacherA.id,
        date: new Date('2026-03-23'),
        startTime: '13:00',
        endTime: '14:00',
        room: 'Room C',
        attendance: 'pending',
        remark: '',
        feedback: '',
        verifyFb: false,
        warning: '',
        classNumber: 3,
      });

      await request(app.getHttpServer())
        .patch(`/schedules/${existing.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance: 'cancelled' })
        .expect(200);

      const schedules = await scheduleRepository.find({
        where: { sessionId: session.id },
      });

      expect(schedules.length).toBe(2);

      const replacement = schedules.find((item) => item.id !== existing.id);
      expect(replacement).toBeDefined();
      expect(replacement.attendance).toBe('pending');
      expect(replacement.room).toBe('TBD');
      expect(replacement.classNumber).toBe(existing.classNumber);
    });
  });
});
