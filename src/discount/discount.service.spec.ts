import { DiscountService } from './discount.service';

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

describe('DiscountService', () => {
  let service: DiscountService;
  const discountRepository = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscountService(discountRepository as any);
  });

  it('TC-DISC-001: findAll returns active discounts from repository query', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1, title: 'Promo' }]),
    };
    discountRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll();

    expect(result).toEqual([{ id: 1, title: 'Promo' }]);
    expect(qb.where).toHaveBeenCalledWith('discount.effective_end_date IS NULL');
  });

  it('TC-DISC-002: findOne returns empty array when discount is not found', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    discountRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findOne('Missing');
    expect(result).toEqual([]);
  });

  it('TC-DISC-003: create() saves discount with expected entity shape', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    discountRepository.createQueryBuilder.mockReturnValue(qb);
    discountRepository.create.mockImplementation((payload) => payload);
    discountRepository.save.mockImplementation(async (payload) => payload);

    const result = await service.create({
      title: 'Early Bird',
      usage: 'all',
      amount: 500,
    } as any);

    expect(discountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Early Bird',
        usage: 'all',
        amount: 500,
        effective_start_date: expect.any(Date),
        effective_end_date: null,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ title: 'Early Bird' }));
  });
});
