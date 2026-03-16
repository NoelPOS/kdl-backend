import { InvoiceService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { DocumentCounter } from './entities/document-counter.entity';
import { Session } from '../session/entities/session.entity';
import { CoursePlus } from '../course-plus/entities/course-plus.entity';
import { Receipt } from '../receipt/entities/receipt.entity';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  getCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    getOne: jest.fn(),
  }),
});

describe('InvoiceService', () => {
  let service: InvoiceService;

  const invoiceRepository = mockRepository();
  const invoiceItemRepository = mockRepository();
  const documentCounterRepository = mockRepository();
  const receiptRepository = mockRepository();

  const trxInvoiceRepo = mockRepository();
  const trxInvoiceItemRepo = mockRepository();
  const trxDocumentCounterRepo = mockRepository();
  const trxSessionRepo = mockRepository();
  const trxCoursePlusRepo = mockRepository();
  const trxReceiptRepo = mockRepository();

  const manager = {
    getRepository: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    manager.getRepository.mockImplementation((entity) => {
      switch (entity) {
        case Invoice:
          return trxInvoiceRepo;
        case InvoiceItem:
          return trxInvoiceItemRepo;
        case DocumentCounter:
          return trxDocumentCounterRepo;
        case Session:
          return trxSessionRepo;
        case CoursePlus:
          return trxCoursePlusRepo;
        case Receipt:
          return trxReceiptRepo;
        default:
          return mockRepository();
      }
    });
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as any),
    );

    service = new InvoiceService(
      invoiceRepository as any,
      invoiceItemRepository as any,
      documentCounterRepository as any,
      receiptRepository as any,
      dataSource as any,
    );
  });

  describe('generateDocumentId()', () => {
    it('TC-INV-001: first invoice of month generates YYYYMM-001', async () => {
      trxDocumentCounterRepo.findOne.mockResolvedValue(null);
      trxDocumentCounterRepo.create.mockImplementation((payload) => payload);
      trxDocumentCounterRepo.save.mockResolvedValue({});

      const documentId = await service.generateDocumentId();

      expect(documentId).toMatch(/^\d{6}-001$/);
      expect(trxDocumentCounterRepo.save).toHaveBeenCalledTimes(1);
    });

    it('TC-INV-002: second invoice increments counter to YYYYMM-002', async () => {
      trxDocumentCounterRepo.findOne.mockResolvedValue({
        date: '202603',
        counter: 1,
      });
      trxDocumentCounterRepo.save.mockResolvedValue({});

      const documentId = await service.generateDocumentId();

      expect(documentId).toMatch(/^\d{6}-002$/);
    });

    it('TC-INV-003: counter padding works for 099 and 100', async () => {
      trxDocumentCounterRepo.save.mockResolvedValue({});

      trxDocumentCounterRepo.findOne.mockResolvedValueOnce({
        date: '202603',
        counter: 98,
      });
      const doc99 = await service.generateDocumentId();

      trxDocumentCounterRepo.findOne.mockResolvedValueOnce({
        date: '202603',
        counter: 99,
      });
      const doc100 = await service.generateDocumentId();

      expect(doc99).toMatch(/^\d{6}-099$/);
      expect(doc100).toMatch(/^\d{6}-100$/);
    });
  });

  describe('create(dto)', () => {
    const baseDto = {
      studentId: 1,
      studentName: 'Student A',
      courseName: 'Math',
      date: '2026-03-16',
      paymentMethod: 'Cash',
      totalAmount: 1000,
      items: [{ description: 'Tuition', amount: 1000 }],
      sessionGroups: [{ sessionId: '1', transactionType: 'course', actualId: '42' }],
    } as any;

    beforeEach(() => {
      jest.spyOn(service, 'generateDocumentId').mockResolvedValue('202603-001');
      trxInvoiceRepo.create.mockImplementation((payload) => payload);
      trxInvoiceRepo.save.mockResolvedValue({ id: 55 });
      trxInvoiceRepo.findOne.mockResolvedValue({ id: 55, items: [] });
      trxInvoiceItemRepo.create.mockImplementation((payload) => payload);
      trxInvoiceItemRepo.save.mockResolvedValue([]);
    });

    it("TC-INV-004: transactionType 'course' sets invoiceDone=true on session", async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 42, packageGroupId: null });

      await service.create(baseDto);

      expect(trxSessionRepo.update).toHaveBeenCalledWith(42, {
        invoiceDone: true,
      });
    });

    it("TC-INV-005: package main session also updates linked TBC sessions", async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 42, packageGroupId: 42 });

      await service.create(baseDto);

      expect(trxSessionRepo.update).toHaveBeenCalledWith(42, {
        invoiceDone: true,
      });
      expect(trxSessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          packageGroupId: 42,
          id: expect.any(Object),
        }),
        { invoiceDone: true },
      );
    });

    it("TC-INV-006: transactionType 'courseplus' handles cp-7 and 7", async () => {
      await service.create({
        ...baseDto,
        sessionGroups: [
          { sessionId: 'cp-7', transactionType: 'courseplus', actualId: 'cp-7' },
          { sessionId: '7', transactionType: 'courseplus', actualId: '7' },
        ],
      });

      expect(trxCoursePlusRepo.update).toHaveBeenNthCalledWith(1, 7, {
        invoiceGenerated: true,
      });
      expect(trxCoursePlusRepo.update).toHaveBeenNthCalledWith(2, 7, {
        invoiceGenerated: true,
      });
    });

    it('TC-INV-008: empty sessionGroups does not call session/courseplus updates', async () => {
      await service.create({
        ...baseDto,
        sessionGroups: [],
      });

      expect(trxSessionRepo.update).not.toHaveBeenCalled();
      expect(trxCoursePlusRepo.update).not.toHaveBeenCalled();
    });
  });
});
