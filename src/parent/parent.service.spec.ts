import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ParentService } from './parent.service';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ParentService', () => {
  let service: ParentService;
  const parentRepository = mockRepository();
  const parentStudentRepo = mockRepository();
  const studentRepository = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParentService(
      parentRepository as any,
      parentStudentRepo as any,
      studentRepository as any,
    );
  });

  it('TC-PAR-001: connectParentToStudent throws when connection already exists', async () => {
    parentStudentRepo.findOne.mockResolvedValue({ id: 1 });

    await expect(service.connectParentToStudent(1, 2)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('TC-PAR-002: connectParentToStudent throws when parent does not exist', async () => {
    parentStudentRepo.findOne.mockResolvedValue(null);
    parentRepository.findOne.mockResolvedValue(null);

    await expect(service.connectParentToStudent(1, 2)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('TC-PAR-003: connectParentToStudent throws when student does not exist', async () => {
    parentStudentRepo.findOne.mockResolvedValue(null);
    parentRepository.findOne.mockResolvedValue({ id: 1 });
    studentRepository.findOne.mockResolvedValue(null);

    await expect(service.connectParentToStudent(1, 2)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('TC-PAR-004: connectParentToStudent saves parent-student link with isPrimary default false', async () => {
    parentStudentRepo.findOne.mockResolvedValue(null);
    parentRepository.findOne.mockResolvedValue({ id: 1 });
    studentRepository.findOne.mockResolvedValue({ id: 2 });
    parentStudentRepo.save.mockImplementation(async (payload) => payload);

    await service.connectParentToStudent(1, 2);

    expect(parentStudentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 1,
        studentId: 2,
        isPrimary: false,
      }),
    );
  });

  it('TC-PAR-005: assignChildrenToParent saves one record per studentId', async () => {
    parentStudentRepo.save.mockImplementation(async (payload) => payload);

    await service.assignChildrenToParent(1, {
      studentIds: [1, 2, 3],
      isPrimary: false,
    } as any);

    const payload = parentStudentRepo.save.mock.calls[0][0];
    expect(payload).toHaveLength(3);
    expect(payload[0]).toEqual(
      expect.objectContaining({ parentId: 1, studentId: 1 }),
    );
  });

  it('TC-PAR-006: findAllParents returns expected pagination metadata', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(25),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    parentRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAllParents(1, 10);

    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(false);
  });
});
