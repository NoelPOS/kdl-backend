import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentCounter } from './entities/student-counter.entity';
import { StudentEntity } from './entities/student.entity';

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
  manager: {
    transaction: jest.fn(),
  },
});

describe('StudentService', () => {
  const buildService = (databaseEnabled: boolean = true) => {
    const studentRepository = mockRepository();
    const sessionRepo = mockRepository();
    const parentRepository = mockRepository();
    const parentStudentRepository = mockRepository();
    const studentCounterRepository = mockRepository();
    const configService = {
      get: jest.fn((key: string) =>
        key === 'DATABASE_ENABLED' ? databaseEnabled : undefined,
      ),
    };

    const service = new StudentService(
      studentRepository as any,
      sessionRepo as any,
      parentRepository as any,
      parentStudentRepository as any,
      configService as any,
      studentCounterRepository as any,
    );

    return {
      service,
      studentRepository,
      parentRepository,
      parentStudentRepository,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TC-STU-001: createStudent throws when DATABASE_ENABLED=false', async () => {
    const { service } = buildService(false);

    await expect(
      service.createStudent({
        name: 'Kid',
        dob: '2015-01-01',
        gender: 'male',
        school: 'ABC',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('TC-STU-002: first student of month gets YYYYMM0001 (10 digits)', async () => {
    const { service, studentRepository } = buildService(true);

    const entityManager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest
        .fn()
        .mockImplementation(async (entity, payload) =>
          entity === StudentEntity ? payload : payload,
        ),
    };
    studentRepository.manager.transaction.mockImplementation(async (cb) =>
      cb(entityManager as any),
    );

    const result = await service.createStudent({
      name: 'Kid A',
      dob: '2015-01-01',
      gender: 'male',
      school: 'ABC',
    } as any);

    expect(entityManager.create).toHaveBeenCalledWith(
      StudentCounter,
      expect.objectContaining({
        yearMonth: expect.stringMatching(/^\d{6}$/),
        counter: 1,
      }),
    );
    expect(result.studentId).toMatch(/^\d{10}$/);
  });

  it('TC-STU-003: second student of month increments counter to ...0002', async () => {
    const { service, studentRepository } = buildService(true);

    const entityManager = {
      findOne: jest.fn().mockResolvedValue({ yearMonth: '202603', counter: 1 }),
      create: jest.fn((entity, payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (_entity, payload) => payload),
    };
    studentRepository.manager.transaction.mockImplementation(async (cb) =>
      cb(entityManager as any),
    );

    const result = await service.createStudent({
      name: 'Kid B',
      dob: '2015-01-01',
      gender: 'female',
      school: 'XYZ',
    } as any);

    expect(result.studentId.endsWith('0002')).toBe(true);
  });

  it('TC-STU-004: findStudentById throws NotFoundException when student not found', async () => {
    const { service, studentRepository } = buildService(true);
    studentRepository.findOne.mockResolvedValue(null);

    await expect(service.findStudentById('999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('TC-STU-005: updateStudent strips parentId before saving StudentEntity', async () => {
    const { service, studentRepository, parentRepository, parentStudentRepository } =
      buildService(true);

    studentRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Old Name' });
    parentRepository.findOneBy.mockResolvedValue({ id: 5, name: 'Parent A' });
    parentStudentRepository.findOne.mockResolvedValue(null);
    parentStudentRepository.update.mockResolvedValue({});
    parentStudentRepository.save.mockResolvedValue({});
    studentRepository.save.mockImplementation(async (payload) => payload);

    await service.updateStudent(1, {
      name: 'New Name',
      parentId: 5,
    } as any);

    const savedStudent = studentRepository.save.mock.calls[0][0];
    expect(savedStudent.name).toBe('New Name');
    expect(Object.prototype.hasOwnProperty.call(savedStudent, 'parentId')).toBe(
      false,
    );
  });
});
