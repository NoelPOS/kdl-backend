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
import { Invoice } from '../../../src/invoice/entities/invoice.entity';
import { Receipt } from '../../../src/receipt/entities/receipt.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('Invoice and Receipt Controllers (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let userRepository: Repository<UserEntity>;
  let teacherRepository: Repository<TeacherEntity>;
  let studentRepository: Repository<StudentEntity>;
  let courseRepository: Repository<CourseEntity>;
  let classOptionRepository: Repository<ClassOption>;
  let sessionRepository: Repository<Session>;
  let invoiceRepository: Repository<Invoice>;
  let receiptRepository: Repository<Receipt>;

  let adminUser: UserEntity;
  let teacherUser: TeacherEntity;
  let student: StudentEntity;
  let course: CourseEntity;
  let classOption: ClassOption;
  let session: Session;
  let adminToken: string;

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
    invoiceRepository = moduleFixture.get<Repository<Invoice>>(
      getRepositoryToken(Invoice),
    );
    receiptRepository = moduleFixture.get<Repository<Receipt>>(
      getRepositoryToken(Receipt),
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
      email: 'admin-billing@test.com',
      password: 'unused-hash',
      role: UserRole.ADMIN,
      profilePicture: '',
      profileKey: null,
    });

    teacherUser = await teacherRepository.save({
      name: 'Teacher Billing',
      email: 'teacher-billing@test.com',
      password: 'unused-hash',
      role: UserRole.TEACHER,
      contactNo: '0800000201',
      lineId: 'U-teacher-billing',
      address: 'Bangkok',
      profilePicture: '',
      profileKey: null,
      teacherType: 'full-time',
      workingDays: ['Wednesday'],
    });

    student = await studentRepository.save({
      studentId: '2026030003',
      name: 'Billing Student',
      nickname: 'BilStu',
      nationalId: null,
      dob: '2015-03-01',
      gender: 'female',
      school: 'KDL School',
      allergic: [],
      doNotEat: [],
      adConcent: false,
      phone: '0813000001',
      profilePicture: '',
      profileKey: null,
    });

    course = await courseRepository.save({
      title: 'Billing Course',
      description: 'Course for billing integration tests',
      ageRange: '7-12',
      medium: 'EN',
    });

    classOption = await classOptionRepository.save({
      classMode: 'private-billing',
      classLimit: 1,
      tuitionFee: 1500,
      effectiveStartDate: new Date('2026-01-01'),
      effectiveEndDate: null,
      optionType: 'check',
    });

    session = await sessionRepository.save({
      studentId: student.id,
      courseId: course.id,
      classOptionId: classOption.id,
      teacherId: teacherUser.id,
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const createInvoicePayload = (sessionId: number) => ({
    studentId: student.id,
    date: '2026-03-25',
    paymentMethod: 'Cash',
    totalAmount: 1500,
    studentName: student.name,
    courseName: course.title,
    sessionGroups: [
      {
        sessionId: sessionId.toString(),
        transactionType: 'course',
        actualId: sessionId.toString(),
      },
    ],
    items: [
      {
        description: 'Tuition Fee',
        amount: 1500,
      },
    ],
  });

  describe('POST /invoices', () => {
    it('should create an invoice and mark related session as invoiceDone', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createInvoicePayload(session.id))
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.items).toHaveLength(1);
          expect(res.body.documentId).toMatch(/^\d{6}-\d{3}$/);
        });

      const updatedSession = await sessionRepository.findOne({
        where: { id: session.id },
      });
      expect(updatedSession.invoiceDone).toBe(true);
    });
  });

  describe('POST /receipts', () => {
    it('should create receipt and mark invoice.receiptDone=true', async () => {
      const invoice = await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createInvoicePayload(session.id))
        .expect(201);

      const invoiceId = invoice.body.id;

      await request(app.getHttpServer())
        .post('/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId,
          date: '2026-03-26',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.invoiceId).toBe(invoiceId);
        });

      const updatedInvoice = await invoiceRepository.findOne({
        where: { id: invoiceId },
      });
      expect(updatedInvoice.receiptDone).toBe(true);

      const receipts = await receiptRepository.find({
        where: { invoiceId },
      });
      expect(receipts).toHaveLength(1);
    });

    it('should return 400 when trying to create duplicate receipt for the same invoice', async () => {
      const invoice = await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createInvoicePayload(session.id))
        .expect(201);

      const invoiceId = invoice.body.id;

      await request(app.getHttpServer())
        .post('/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId,
          date: '2026-03-26',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/receipts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceId,
          date: '2026-03-27',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Receipt has already been generated',
          );
        });
    });
  });
});

