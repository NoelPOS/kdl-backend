import { NotFoundException } from '@nestjs/common';
import { CoursePackageService } from './course-package.service';

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

describe('CoursePackageService', () => {
  let service: CoursePackageService;
  const repo = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoursePackageService(repo as any);
  });

  it('TC-CPKG-001: create() new name saves without expiring existing package', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    repo.create.mockImplementation((payload) => payload);
    repo.save.mockImplementation(async (payload) => payload);

    await service.create({
      name: 'Package 10',
      numberOfCourses: 10,
      effectiveStartDate: '2026-05-01',
    } as any);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('TC-CPKG-002: create() same name expires previous active package', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 3, name: 'Package 10' }),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    repo.create.mockImplementation((payload) => payload);
    repo.save.mockImplementation(async (payload) => payload);

    await service.create({
      name: 'Package 10',
      numberOfCourses: 10,
      effectiveStartDate: '2026-05-01',
    } as any);

    expect(repo.update).toHaveBeenCalledWith(3, {
      effectiveEndDate: new Date('2026-04-30'),
    });
  });

  it('TC-CPKG-003: update() only changes effectiveEndDate', async () => {
    repo.findOne
      .mockResolvedValueOnce({
        id: 1,
        name: 'Package 10',
        numberOfCourses: 10,
        effectiveEndDate: null,
      })
      .mockResolvedValueOnce({
        id: 1,
        name: 'Package 10',
        numberOfCourses: 10,
        effectiveEndDate: new Date('2026-12-31'),
      });

    await service.update(1, {
      name: 'New Name',
      numberOfCourses: 99,
      effectiveEndDate: '2026-12-31',
    } as any);

    expect(repo.update).toHaveBeenCalledWith(1, {
      effectiveEndDate: new Date('2026-12-31'),
    });
  });

  it('TC-CPKG-004: findOne(id) throws NotFoundException when missing', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('TC-CPKG-005: remove(id) calls delete after package is found', async () => {
    repo.findOne.mockResolvedValue({ id: 5 });

    await service.remove(5);

    expect(repo.delete).toHaveBeenCalledWith(5);
  });
});
