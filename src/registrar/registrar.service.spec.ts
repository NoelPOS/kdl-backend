import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import { RegistrarService } from './registrar.service';
import { UserRole } from '../common/enums/user-role.enum';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

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

describe('RegistrarService', () => {
  let service: RegistrarService;
  const userRepository = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RegistrarService(userRepository as any);
  });

  it('TC-REG-001: createRegistrar throws ConflictException when email already exists', async () => {
    userRepository.findOne.mockResolvedValue({ id: 1, email: 'a@test.com' });

    await expect(
      service.createRegistrar({
        name: 'Alice',
        email: 'a@test.com',
        password: 'secret',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('TC-REG-002: createRegistrar saves with REGISTRAR role and hashed password', async () => {
    userRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    userRepository.create.mockImplementation((payload) => payload);
    userRepository.save.mockImplementation(async (payload) => ({
      id: 99,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    }));

    await service.createRegistrar({
      name: 'Alice',
      email: 'a@test.com',
      password: 'secret',
    } as any);

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.REGISTRAR,
        password: 'hashed-password',
      }),
    );
  });

  it('TC-REG-003: createRegistrar maps dto.name -> entity.userName', async () => {
    userRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    userRepository.create.mockImplementation((payload) => payload);
    userRepository.save.mockImplementation(async (payload) => ({
      id: 99,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    }));

    await service.createRegistrar({
      name: 'Alice',
      email: 'a@test.com',
      password: 'secret',
    } as any);

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: 'Alice',
      }),
    );
  });

  it('TC-REG-004: findAllRegistrars returns correct pagination metadata', async () => {
    userRepository.findAndCount.mockResolvedValue([
      [{ id: 1, userName: 'Reg 1', email: 'r1@test.com', role: UserRole.REGISTRAR }],
      15,
    ]);

    const result = await service.findAllRegistrars('all', 2, 5);

    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasPrev).toBe(true);
    expect(result.pagination.currentPage).toBe(2);
  });
});
