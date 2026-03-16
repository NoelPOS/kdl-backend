import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ParentVerificationService } from './parent-verification.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

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

describe('ParentVerificationService', () => {
  let service: ParentVerificationService;
  const parentRepository = mockRepository();
  const lineMessagingService = {
    sendTextMessage: jest.fn(),
  };
  const richMenuService = {
    assignVerifiedMenu: jest.fn(),
    assignUnverifiedMenu: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParentVerificationService(
      parentRepository as any,
      lineMessagingService as any,
      richMenuService as any,
    );
  });

  it('TC-PVER-001: throws when neither email nor contactNo is provided', async () => {
    await expect(
      service.verifyAndLinkParent({
        lineUserId: 'U123',
        password: '123456',
      } as any),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.verifyAndLinkParent({
        lineUserId: 'U123',
        password: '123456',
      } as any),
    ).rejects.toThrow(/either email or phone number/i);
  });

  it('TC-PVER-002: throws when LINE userId is already linked', async () => {
    parentRepository.findOne.mockResolvedValue({
      id: 99,
      name: 'Existing Parent',
      lineId: 'U123',
    });

    await expect(
      service.verifyAndLinkParent({
        lineUserId: 'U123',
        email: 'parent@test.com',
        password: '123456',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('TC-PVER-003: throws NotFoundException when no parent matches email/phone', async () => {
    parentRepository.findOne.mockResolvedValue(null);
    parentRepository.find.mockResolvedValue([]);

    await expect(
      service.verifyAndLinkParent({
        lineUserId: 'U123',
        email: 'x@x.com',
        password: '123456',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('TC-PVER-004: links LINE id, assigns verified rich menu, and sends success message', async () => {
    const parent = {
      id: 7,
      name: 'Parent A',
      email: 'parent@test.com',
      password: 'hashed-password',
      lineId: null,
    };

    parentRepository.findOne.mockResolvedValue(null);
    parentRepository.find.mockResolvedValue([parent]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    parentRepository.save.mockImplementation(async (payload) => payload);

    const result = await service.verifyAndLinkParent({
      lineUserId: 'U123',
      email: 'parent@test.com',
      password: '123456',
    } as any);

    expect(parentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, lineId: 'U123' }),
    );
    expect(richMenuService.assignVerifiedMenu).toHaveBeenCalledWith('U123');
    expect(lineMessagingService.sendTextMessage).toHaveBeenCalledWith(
      'U123',
      expect.any(String),
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        parent: expect.objectContaining({ id: 7, name: 'Parent A' }),
      }),
    );
  });
});
