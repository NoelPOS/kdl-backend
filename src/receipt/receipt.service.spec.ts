import { BadRequestException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ReceiptService', () => {
  let service: ReceiptService;
  const receiptRepository = mockRepository();
  const invoiceService = {
    findOne: jest.fn(),
    markReceiptDone: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReceiptService(
      receiptRepository as any,
      invoiceService as any,
    );
  });

  it('TC-RCP-001: throws when invoice already has receiptDone=true', async () => {
    invoiceService.findOne.mockResolvedValue({ id: 1, receiptDone: true });

    await expect(
      service.create({
        invoiceId: 1,
        date: '2026-03-16',
      } as any),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        invoiceId: 1,
        date: '2026-03-16',
      } as any),
    ).rejects.toThrow(/Receipt has already been generated/i);
  });

  it('TC-RCP-002: creates receipt and marks invoice as receipt done', async () => {
    invoiceService.findOne.mockResolvedValue({ id: 1, receiptDone: false });
    receiptRepository.create.mockImplementation((payload) => payload);
    receiptRepository.save.mockResolvedValue({ id: 10, invoiceId: 1 });
    receiptRepository.findOne.mockResolvedValue({
      id: 10,
      invoiceId: 1,
      invoice: { id: 1 },
    });

    const result = await service.create({
      invoiceId: 1,
      date: '2026-03-16',
    } as any);

    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 1, date: expect.any(Date) }),
    );
    expect(invoiceService.markReceiptDone).toHaveBeenCalledWith(1);
    expect(result).toEqual(expect.objectContaining({ id: 10, invoiceId: 1 }));
  });
});
