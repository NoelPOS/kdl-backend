import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { TeacherService } from './teacher.service';

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

describe('TeacherService', () => {
  let service: TeacherService;
  const teacherRepository = mockRepository();
  const teacherCourseRepo = mockRepository();
  const teacherAbsenceRepo = mockRepository();
  const teacherAvailabilityRepo = mockRepository();
  const sessionRepo = mockRepository();
  const courseRepository = mockRepository();
  const scheduleRepo = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeacherService(
      teacherRepository as any,
      teacherCourseRepo as any,
      teacherAbsenceRepo as any,
      teacherAvailabilityRepo as any,
      sessionRepo as any,
      courseRepository as any,
      scheduleRepo as any,
    );
  });

  it('TC-TCH-001: createTeacher throws when same email already exists', async () => {
    teacherRepository.findOne.mockResolvedValue({ id: 1, email: 't@test.com' });

    await expect(
      service.createTeacher({
        name: 'Teacher A',
        email: 't@test.com',
        password: 'secret',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('TC-TCH-002: createTeacher hashes password before saving', async () => {
    teacherRepository.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    teacherRepository.save.mockImplementation(async (payload) => payload);

    const result = await service.createTeacher({
      name: 'Teacher A',
      email: 't@test.com',
      password: 'raw-password',
    } as any);

    expect(result.password).not.toBe('raw-password');
    expect(result.password).toBe('hashed-password');
  });

  it('TC-TCH-003: getTeacherCourses(query) uses queryBuilder LOWER LIKE filter', async () => {
    teacherRepository.findOne.mockResolvedValue({ id: 1 });
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    teacherCourseRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getTeacherCourses(1, 'math', 1, 10);

    expect(qb.andWhere).toHaveBeenCalledWith(
      'LOWER(course.name) LIKE LOWER(:query)',
      { query: '%math%' },
    );
  });

  it('TC-TCH-004: getTeacherCourses(no query) uses findAndCount', async () => {
    teacherRepository.findOne.mockResolvedValue({ id: 1 });
    teacherCourseRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.getTeacherCourses(1, undefined, 1, 10);

    expect(teacherCourseRepo.findAndCount).toHaveBeenCalled();
    expect(teacherCourseRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('TC-TCH-005: createTeacherAbsence saves absence linked to teacher', async () => {
    teacherRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Teacher A' });
    teacherAbsenceRepo.save.mockImplementation(async (payload) => payload);

    await service.createTeacherAbsence(1, {
      absenceDate: '2026-03-20',
      reason: 'Sick leave',
    } as any);

    expect(teacherAbsenceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 1,
        reason: 'Sick leave',
      }),
    );
  });
});
