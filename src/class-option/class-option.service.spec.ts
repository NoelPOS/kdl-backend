import { NotFoundException } from '@nestjs/common';
import { ClassOptionService } from './class-option.service';

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

describe('ClassOptionService', () => {
  let service: ClassOptionService;
  const classOptionRepository = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassOptionService(classOptionRepository as any);
  });

  it('TC-CLSOPT-001: create() with new classMode saves without expiring existing option', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    classOptionRepository.createQueryBuilder.mockReturnValue(qb);
    classOptionRepository.create.mockImplementation((payload) => payload);
    classOptionRepository.save.mockImplementation(async (payload) => payload);

    await service.create({
      classMode: 'online',
      classLimit: 6,
      tuitionFee: 6000,
      effectiveStartDate: '2026-04-01',
    } as any);

    expect(classOptionRepository.update).not.toHaveBeenCalled();
    expect(classOptionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('TC-CLSOPT-002: create() expires existing active classMode one day before new start', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 5, classMode: 'online' }),
    };
    classOptionRepository.createQueryBuilder.mockReturnValue(qb);
    classOptionRepository.create.mockImplementation((payload) => payload);
    classOptionRepository.save.mockImplementation(async (payload) => payload);

    await service.create({
      classMode: 'online',
      classLimit: 8,
      tuitionFee: 8000,
      effectiveStartDate: '2026-04-01',
    } as any);

    expect(classOptionRepository.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        effectiveEndDate: new Date('2026-03-31'),
      }),
    );
  });

  it("TC-CLSOPT-003: findAll() applies classMode filter excluding 'package'", async () => {
    classOptionRepository.find.mockResolvedValue([]);

    await service.findAll();

    expect(classOptionRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classMode: expect.any(Object),
        }),
      }),
    );
  });

  it('TC-CLSOPT-004: findOne(id) throws NotFoundException when not found', async () => {
    classOptionRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });
});
