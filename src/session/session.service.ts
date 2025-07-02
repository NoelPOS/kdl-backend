import { Injectable } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClassOption,
  InvoiceItem,
  Receipt,
  Session,
} from './entities/session.entity';
import { Repository } from 'typeorm';
import { Schedule } from '../schedule/entities/schedule.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { ReceiptFilterDto } from './dto/receipt-filter.dto';
import { Invoice } from 'src/session/entities/session.entity';
import { DataSource } from 'typeorm';

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
    await this.sessionRepository.update(id, dto);
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
          attendance: 'Completed',
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
      });
    }

    return result;
  }

  async getPendingSessionsForInvoice() {
    return await this.sessionRepository
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
        'classOption.tuitionFee',
      ])
      .where('session.invoiceDone = :invoiceDone', { invoiceDone: false })
      .getRawMany();
  }

  async getSpecificPendingSessionsForInvoice(sessionId: number) {
    return await this.sessionRepository
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
        'classOption.tuitionFee',
      ])
      .where('session.invoiceDone = :invoiceDone', { invoiceDone: false })
      .andWhere('session.id = :sessionId', { sessionId })
      .getRawOne();
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

  async listInvoices(filter: InvoiceFilterDto) {
    console.log('filter', typeof filter.receiptDone);
    const {
      page = 1,
      limit = 10,
      from,
      to,
      sessionId,
      studentId,
      courseName,
      documentId,
      paymentMethod,
      receiptDone,
    } = filter;
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoin('invoice.session', 'session')
      .leftJoin('session.student', 'student')
      .leftJoin('session.course', 'course')
      .orderBy('invoice.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
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
        'student.id',
        'student.name',
        'course.title',
      ]);
    if (from) qb.andWhere('invoice.date >= :from', { from });
    if (to) qb.andWhere('invoice.date <= :to', { to });
    if (sessionId) qb.andWhere('invoice.sessionId = :sessionId', { sessionId });
    if (studentId) qb.andWhere('student.id = :studentId', { studentId });
    if (courseName) qb.andWhere('course.title = :courseName', { courseName });
    if (documentId)
      qb.andWhere('invoice.documentId = :documentId', { documentId });
    if (paymentMethod)
      qb.andWhere('invoice.paymentMethod = :paymentMethod', { paymentMethod });
    if (typeof receiptDone === 'string') {
      if (receiptDone.toLowerCase() === 'true') {
        qb.andWhere('invoice.receiptDone = :receiptDone', {
          receiptDone: true,
        });
      } else if (receiptDone.toLowerCase() === 'false') {
        qb.andWhere('invoice.receiptDone = :receiptDone', {
          receiptDone: false,
        });
      }
    } else if (typeof receiptDone === 'boolean') {
      qb.andWhere('invoice.receiptDone = :receiptDone', { receiptDone });
    }

    const [invoices, total] = await qb.getManyAndCount();

    return { invoices, total, page, limit };
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
