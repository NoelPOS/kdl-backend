import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClassOption,
  InvoiceItem,
  Receipt,
  Session,
} from './entities/session.entity';
import { Repository, ILike } from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { ReceiptFilterDto } from './dto/receipt-filter.dto';
import { Invoice } from '../session/entities/session.entity';
import { DataSource } from 'typeorm';
import { StudentSessionFilterDto } from './dto/student-session-filter.dto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,

    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,

    @InjectRepository(ClassOption)
    private readonly classOptionRepo: Repository<ClassOption>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,

    @InjectRepository(Receipt)
    private readonly receiptRepo: Repository<Receipt>,

    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateSessionDto) {
    // Check for existing session with same studentId, courseId, and classOptionId
    console.log('Creating session with data:', dto);
    const existing = await this.sessionRepository.findOne({
      where: {
        studentId: dto.studentId,
        courseId: dto.courseId,
        classOptionId: dto.classOptionId,
        teacherId: dto.teacherId,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A session with the same student, course, and class option already exists.',
      );
    }
    const session = this.sessionRepository.create(dto);
    session.createdAt = new Date();
    session.invoiceDone = false;
    return await this.sessionRepository.save(session);
  }

  async findAll() {
    return this.sessionRepository.find({ relations: ['course'] });
  }

  async findOne(id: number) {
    return this.sessionRepository.findOne({
      where: { id },
      relations: ['course'],
    });
  }

  async update(id: number, dto: UpdateSessionDto) {
    const result = await this.sessionRepository.update(id, dto);
    if (result.affected === 0) {
      throw new BadRequestException(`Session with ID ${id} not found`);
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    const session = await this.findOne(id);
    if (!session) {
      return null;
    }
    await this.sessionRepository.remove(session);
    return session;
  }

  async getStudentSessions(studentId: number) {
    return this.sessionRepository.find({
      where: { studentId },
      relations: ['course', 'teacher'],
    });
  }

  async getStudentSessionByCourse(studentId: number, courseId: number) {
    return this.sessionRepository.findOne({
      where: { studentId, courseId },
      relations: ['course', 'teacher'],
    });
  }

  async getSessionOverviewByStudentId(studentId: number) {
    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('session.studentId = :studentId', { studentId })
      .getMany();

    const result = [];

    for (const s of sessions) {
      const completedCount = await this.scheduleRepo.count({
        where: {
          sessionId: s.id,
          attendance: 'present',
        },
      });

      result.push({
        sessionId: s.id,
        courseTitle: s.course?.title,
        courseDescription: s.course?.description,
        mode: s.classOption.classMode,
        payment: s.payment,
        completedCount,
        classCancel: s.classCancel,
        medium: s.course.medium,
      });
    }

    return result;
  }

  async getStudentSessionsFiltered(
    studentId: number,
    filterDto: StudentSessionFilterDto,
  ) {
    const { courseName, status, payment, page = 1, limit = 12 } = filterDto;

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // Build the query
    const queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.classOption', 'classOption')
      .where('session.studentId = :studentId', { studentId });

    // Apply filters
    if (courseName) {
      queryBuilder.andWhere('course.title ILIKE :courseName', {
        courseName: `%${courseName}%`,
      });
    }

    if (status) {
      if (status === 'completed') {
        queryBuilder.andWhere('session.status = :status', {
          status: 'Completed',
        });
      } else if (status === 'wip') {
        queryBuilder.andWhere('session.status = :status', { status: 'WP' });
      }
    }

    if (payment) {
      if (payment === 'paid') {
        queryBuilder.andWhere('session.payment = :payment', {
          payment: 'Paid',
        });
      } else if (payment === 'unpaid') {
        queryBuilder.andWhere('session.payment = :payment', {
          payment: 'Unpaid',
        });
      }
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.getCount();

    // Apply pagination
    const offset = (validatedPage - 1) * validatedLimit;
    queryBuilder.skip(offset).take(validatedLimit);

    // Order by creation date (newest first)
    queryBuilder.orderBy('session.createdAt', 'DESC');

    // Get the sessions
    const sessions = await queryBuilder.getMany();

    // Build the result with progress calculation
    const result = [];
    for (const session of sessions) {
      const completedCount = await this.scheduleRepo.count({
        where: {
          sessionId: session.id,
          attendance: 'present',
        },
      });

      // Calculate total scheduled classes for this session
      const totalScheduledCount = await this.scheduleRepo.count({
        where: {
          sessionId: session.id,
        },
      });

      // Calculate progress percentage
      const progressPercentage =
        totalScheduledCount > 0
          ? Math.round((completedCount / totalScheduledCount) * 100)
          : 0;

      result.push({
        sessionId: session.id,
        courseTitle: session.course?.title,
        courseDescription: session.course?.description,
        mode: session.classOption.classMode,
        payment: session.payment,
        completedCount,
        classCancel: session.classCancel,
        progress: `${progressPercentage}%`,
        medium: session.course.medium,
        status: session.status,
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / validatedLimit);
    const hasNext = validatedPage < totalPages;
    const hasPrev = validatedPage > 1;

    return {
      sessions: result,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
      },
    };
  }

  async getPendingSessionsForInvoice(
    date?: string,
    status?: string,
    course?: string,
    teacher?: string,
    student?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    enrollments: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    console.log('Fetching pending sessions with filters:', {
      date,
      status,
      course,
      teacher,
      student,
      page,
      limit,
    });

    // Validate pagination parameters
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // First, get the session IDs that match our criteria for counting
    let countQueryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .leftJoin('session.teacher', 'teacher')
      .leftJoin('session.classOption', 'classOption');

    // Base filter - only pending invoices by default
    if (!status || status === 'all') {
      countQueryBuilder = countQueryBuilder.where(
        'session.invoiceDone = :invoiceDone',
        {
          invoiceDone: false,
        },
      );
    } else if (status === 'completed') {
      countQueryBuilder = countQueryBuilder.where(
        'session.invoiceDone = :invoiceDone',
        {
          invoiceDone: true,
        },
      );
    }

    // Add filtering conditions to count query
    if (date) {
      countQueryBuilder = countQueryBuilder.andWhere(
        'DATE(session.createdAt) = :date',
        {
          date,
        },
      );
    }

    if (course) {
      countQueryBuilder = countQueryBuilder.andWhere(
        'course.title ILIKE :course',
        {
          course: `%${course}%`,
        },
      );
    }

    if (teacher) {
      countQueryBuilder = countQueryBuilder.andWhere(
        'teacher.name ILIKE :teacher',
        {
          teacher: `%${teacher}%`,
        },
      );
    }

    if (student) {
      countQueryBuilder = countQueryBuilder.andWhere(
        'student.name ILIKE :student',
        {
          student: `%${student}%`,
        },
      );
    }

    // Get total count for pagination
    const totalCount = await countQueryBuilder.getCount();
    const totalPages = Math.ceil(totalCount / limit);

    // Now build the main query with pagination and sort by createdAt
    let queryBuilder = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .leftJoin('session.teacher', 'teacher')
      .leftJoin('session.classOption', 'classOption')
      .select([
        'session.id as session_id',
        'session.createdAt as session_createdAt',
        'session.status as session_status',
        'session.payment as session_payment',
        'session.invoiceDone as session_invoiceDone',
        'student.id as student_id',
        'student.name as student_name',
        'course.id as course_id',
        'course.title as course_title',
        'teacher.id as teacher_id',
        'teacher.name as teacher_name',
        'classOption.tuitionFee as classOption_tuitionFee',
      ]);
    // Apply the same filters to the main query
    if (!status || status === 'pending') {
      queryBuilder = queryBuilder.where('session.invoiceDone = :invoiceDone', {
        invoiceDone: false,
      });
    } else if (status === 'completed') {
      queryBuilder = queryBuilder.where('session.invoiceDone = :invoiceDone', {
        invoiceDone: true,
      });
    }

    if (date) {
      queryBuilder = queryBuilder.andWhere('DATE(session.createdAt) = :date', {
        date,
      });
    }

    if (course) {
      queryBuilder = queryBuilder.andWhere('course.title ILIKE :course', {
        course: `%${course}%`,
      });
    }

    if (teacher) {
      queryBuilder = queryBuilder.andWhere('teacher.name ILIKE :teacher', {
        teacher: `%${teacher}%`,
      });
    }

    if (student) {
      queryBuilder = queryBuilder.andWhere('student.name ILIKE :student', {
        student: `%${student}%`,
      });
    }

    // Add ordering and pagination
    queryBuilder = queryBuilder
      .orderBy('session.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const enrollments = await queryBuilder.getRawMany();

    console.log(
      `Returning ${enrollments.length} enrollments out of ${totalCount} total`,
    );

    return {
      enrollments,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getSpecificPendingSessionsForInvoice(sessionId: number) {
    console.log(
      'Fetching specific pending session for invoice with ID:',
      sessionId,
    );
    const session = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .leftJoin('session.classOption', 'classOption')
      .select([
        'session.id',
        'session.createdAt',
        'student.id',
        'student.name',
        'course.title',
        'classOption.tuitionFee as classoption_tuitionfee',
      ])
      .andWhere('session.id = :sessionId', { sessionId })
      .getRawOne();

    console.log('Fetched specific pending session for invoice:', session);
    return session;
  }

  async getInvoice(id: number) {
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoin('invoice.session', 'session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('invoice.id = :id', { id })
      .select([
        'invoice.id',
        'invoice.documentId',
        'invoice.date',
        'invoice.paymentMethod',
        'invoice.totalAmount',
        'invoice.sessionId',
        'invoice.receiptDone',
        'items',
        'session.id',
        'student.name',
        'course.title',
      ]);
    const invoice = await qb.getOne();
    if (!invoice) return null;
    return invoice;
  }

  async getReceipt(id: number) {
    return this.receiptRepo.findOne({
      where: { id },
      relations: [
        'invoice',
        'invoice.items',
        'invoice.session',
        'invoice.session.student',
        'invoice.session.course',
      ],
    });
  }

  async listInvoices(
    page: number = 1,
    limit: number = 10,
    documentId?: string,
    student?: string,
    course?: string,
    receiptDone?: string,
  ): Promise<{
    invoices: Invoice[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const offset = (page - 1) * limit;

    const queryBuilder = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.session', 'session')
      .leftJoinAndSelect('session.student', 'student')
      .leftJoinAndSelect('session.course', 'course')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .leftJoinAndSelect('invoice.items', 'items')
      .orderBy('invoice.date', 'DESC');

    if (documentId) {
      queryBuilder.andWhere('invoice.documentId ILIKE :documentId', {
        documentId: `%${documentId}%`,
      });
    }

    if (student) {
      queryBuilder.andWhere('student.name ILIKE :studentName', {
        studentName: `%${student}%`,
      });
    }

    if (course) {
      queryBuilder.andWhere('course.title ILIKE :courseName', {
        courseName: `%${course}%`,
      });
    }

    if (receiptDone == 'completed') {
      queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
        receiptDone: true,
      });
    } else if (receiptDone == 'pending') {
      queryBuilder.andWhere('invoice.receiptDone = :receiptDone', {
        receiptDone: false,
      });
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Get paginated data
    const invoices = await queryBuilder.offset(offset).limit(limit).getMany();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      invoices,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async listReceipts(filter: ReceiptFilterDto) {
    const {
      page = 1,
      limit = 10,
      from,
      to,
      invoiceId,
      sessionId,
      studentId,
      courseId,
      receiptNumber,
    } = filter;

    const qb = this.receiptRepo
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.invoice', 'invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.session', 'session')
      .leftJoinAndSelect('session.student', 'student')
      .leftJoinAndSelect('session.course', 'course')
      .orderBy('receipt.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (from) qb.andWhere('receipt.date >= :from', { from });
    if (to) qb.andWhere('receipt.date <= :to', { to });
    if (invoiceId) qb.andWhere('receipt.invoiceId = :invoiceId', { invoiceId });
    if (sessionId) qb.andWhere('invoice.sessionId = :sessionId', { sessionId });
    if (studentId) qb.andWhere('student.id = :studentId', { studentId });
    if (courseId) qb.andWhere('course.id = :courseId', { courseId });
    if (receiptNumber)
      qb.andWhere('receipt.receiptNumber = :receiptNumber', { receiptNumber });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async createClassOption(dto: {
    classMode: string;
    classLimit: number;
    tuitionFee: number;
  }) {
    const current = await this.classOptionRepo.findOne({
      where: { classMode: dto.classMode, effectiveEndDate: null },
    });
    if (current) {
      current.effectiveEndDate = new Date();
      await this.classOptionRepo.save(current);
    }
    const newOption = this.classOptionRepo.create({
      ...dto,
      effectiveStartDate: new Date(),
      effectiveEndDate: null,
    });
    return this.classOptionRepo.save(newOption);
  }

  async listClassOptions() {
    return this.classOptionRepo.find();
  }

  async createInvoiceAndMarkSession(dto: CreateInvoiceDto) {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const invoice = invoiceRepo.create({
        sessionId: dto.sessionId,
        documentId: dto.documentId,
        date: new Date(dto.date),
        paymentMethod: dto.paymentMethod,
        totalAmount: dto.totalAmount,
        items: dto.items.map((item) =>
          manager.getRepository(InvoiceItem).create(item),
        ),
      });
      const savedInvoice = await invoiceRepo.save(invoice);

      const sessionRepo = manager.getRepository(Session);
      await sessionRepo.update(dto.sessionId, { invoiceDone: true });

      return savedInvoice;
    });
  }

  async createReceiptAndMarkPaid(dto: CreateReceiptDto) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(Receipt);
      const receipt = receiptRepo.create({
        invoiceId: dto.invoiceId,
        date: new Date(dto.date),
      });
      const savedReceipt = await receiptRepo.save(receipt);

      const invoiceRepo = manager.getRepository(Invoice);
      const invoice = await invoiceRepo.findOne({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new Error('Invoice not found');
      const sessionRepo = manager.getRepository(Session);
      await sessionRepo.update(invoice.sessionId, { payment: 'paid' });

      await invoiceRepo.update(dto.invoiceId, { receiptDone: true });

      return savedReceipt;
    });
  }
}
