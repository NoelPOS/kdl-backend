import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionService } from './session.service';
import { Session } from './entities/session.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { CoursePackage } from '../course-package/entities/course-package.entity';
import { DocumentCounter } from '../invoice/entities/document-counter.entity';

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

describe('SessionService', () => {
  let service: SessionService;

  const sessionRepository = mockRepository();
  const scheduleRepo = mockRepository();
  const classOptionRepo = mockRepository();
  const courseRepo = mockRepository();
  const invoiceRepo = mockRepository();
  const invoiceItemRepo = mockRepository();
  const receiptRepo = mockRepository();
  const coursePlusRepo = mockRepository();
  const coursePackageRepo = mockRepository();
  const documentCounterRepo = mockRepository();

  const classOptionService = { create: jest.fn(), findAll: jest.fn() };
  const invoiceService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    getNextDocumentId: jest.fn(),
  };
  const receiptService = { findOne: jest.fn(), findAll: jest.fn() };

  const trxSessionRepo = mockRepository();
  const trxScheduleRepo = mockRepository();
  const trxCoursePackageRepo = mockRepository();
  const trxDocumentCounterRepo = mockRepository();

  const scheduleUpdateQB = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

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
        case Session:
          return trxSessionRepo;
        case Schedule:
          return trxScheduleRepo;
        case CoursePackage:
          return trxCoursePackageRepo;
        case DocumentCounter:
          return trxDocumentCounterRepo;
        default:
          return mockRepository();
      }
    });

    dataSource.transaction.mockImplementation(async (cb) => cb(manager as any));
    trxScheduleRepo.createQueryBuilder.mockReturnValue(scheduleUpdateQB as any);

    service = new SessionService(
      sessionRepository as any,
      scheduleRepo as any,
      classOptionRepo as any,
      courseRepo as any,
      invoiceRepo as any,
      invoiceItemRepo as any,
      receiptRepo as any,
      coursePlusRepo as any,
      coursePackageRepo as any,
      documentCounterRepo as any,
      dataSource as any,
      classOptionService as any,
      invoiceService as any,
      receiptService as any,
    );
  });

  describe('create(dto)', () => {
    const createDto = {
      studentId: 1,
      courseId: 2,
      classOptionId: 1,
      teacherId: 3,
      classCancel: 0,
      payment: 'unpaid',
      status: 'wip',
    };

    it('TC-SES-001: sets invoiceDone=false by default', async () => {
      sessionRepository.create.mockImplementation((payload) => ({ ...payload }));
      sessionRepository.save.mockImplementation(async (payload) => payload);

      await service.create(createDto as any);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceDone: false }),
      );
    });

    it('TC-SES-002: classOptionId=11 sets random numeric packageGroupId', async () => {
      sessionRepository.create.mockImplementation((payload) => ({ ...payload }));
      sessionRepository.save.mockImplementation(async (payload) => payload);

      await service.create({ ...createDto, classOptionId: 11 } as any);

      const savedSession = sessionRepository.save.mock.calls[0][0];
      expect(savedSession.packageGroupId).toEqual(expect.any(Number));
      expect(savedSession.packageGroupId).not.toBeNull();
    });

    it('TC-SES-003: classOptionId!=11 sets packageGroupId=null', async () => {
      sessionRepository.create.mockImplementation((payload) => ({ ...payload }));
      sessionRepository.save.mockImplementation(async (payload) => payload);

      await service.create({ ...createDto, classOptionId: 10 } as any);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ packageGroupId: null }),
      );
    });
  });

  describe('createPackage(dto)', () => {
    const createPackageDto = {
      studentId: 5,
      packageId: 20,
      price: 12000,
    };

    beforeEach(() => {
      trxSessionRepo.create.mockImplementation((payload) => payload);
      trxSessionRepo.save
        .mockResolvedValueOnce({ id: 99 })
        .mockResolvedValueOnce([]);
      trxSessionRepo.update.mockResolvedValue({ affected: 1 });
      classOptionRepo.findOne.mockResolvedValue({ id: 11 });
    });

    it('TC-SES-004: throws when course package not found', async () => {
      trxCoursePackageRepo.findOne.mockResolvedValue(null);

      await expect(service.createPackage(createPackageDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('TC-SES-005: throws when TBC course not found', async () => {
      trxCoursePackageRepo.findOne.mockResolvedValue({
        id: 20,
        numberOfCourses: 5,
        name: 'Package 5',
        price: 12000,
      });
      courseRepo.findOne.mockResolvedValue(null);

      await expect(service.createPackage(createPackageDto as any)).rejects.toThrow(
        /TBC course not found/i,
      );
    });

    it('TC-SES-006: creates exactly numberOfCourses TBC sessions (+1 package main)', async () => {
      trxCoursePackageRepo.findOne.mockResolvedValue({
        id: 20,
        numberOfCourses: 5,
        name: 'Package 5',
        price: 12000,
      });
      courseRepo.findOne.mockResolvedValue({ id: 777, title: 'TBC' });

      await service.createPackage(createPackageDto as any);

      expect(trxSessionRepo.create).toHaveBeenCalledTimes(6);
    });

    it('TC-SES-007: all TBC sessions use packageGroupId of main session', async () => {
      trxCoursePackageRepo.findOne.mockResolvedValue({
        id: 20,
        numberOfCourses: 3,
        name: 'Package 3',
        price: 12000,
      });
      courseRepo.findOne.mockResolvedValue({ id: 777, title: 'TBC' });

      await service.createPackage(createPackageDto as any);

      const tbcCreateCalls = trxSessionRepo.create.mock.calls.slice(1);
      tbcCreateCalls.forEach(([payload]) => {
        expect(payload.packageGroupId).toBe(99);
      });
    });
  });

  describe('generateDocumentId()', () => {
    it('TC-SES-008: first document of day generates YYYYMMDD0001', async () => {
      trxDocumentCounterRepo.findOne.mockResolvedValue(null);
      trxDocumentCounterRepo.create.mockImplementation((payload) => payload);
      trxDocumentCounterRepo.save.mockResolvedValue({});

      const documentId = await service.generateDocumentId();
      expect(documentId).toMatch(/^\d{8}0001$/);
    });

    it('TC-SES-009: second document of day generates YYYYMMDD0002', async () => {
      trxDocumentCounterRepo.findOne.mockResolvedValue({
        date: '2026-03-16',
        counter: 1,
      });
      trxDocumentCounterRepo.save.mockResolvedValue({});

      const documentId = await service.generateDocumentId();
      expect(documentId).toMatch(/^\d{8}0002$/);
    });
  });

  describe('update(id, dto)', () => {
    it('TC-SES-010: package main update cascades to linked TBC sessions', async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 10, packageGroupId: 10 });
      trxSessionRepo.update.mockResolvedValue({ affected: 1 });
      sessionRepository.findOne.mockResolvedValue({ id: 10 });

      await service.update(10, { teacherId: 5 } as any);

      expect(trxSessionRepo.update).toHaveBeenNthCalledWith(1, 10, {
        teacherId: 5,
      });
      expect(trxSessionRepo.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ packageGroupId: 10, id: expect.any(Object) }),
        { teacherId: 5 },
      );
    });

    it('TC-SES-011: non-package session updates only once', async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 10, packageGroupId: null });
      trxSessionRepo.update.mockResolvedValue({ affected: 1 });
      sessionRepository.findOne.mockResolvedValue({ id: 10 });

      await service.update(10, { teacherId: 5 } as any);

      expect(trxSessionRepo.update).toHaveBeenCalledTimes(1);
    });

    it('TC-SES-012: throws when session not found', async () => {
      trxSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { teacherId: 5 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelSession(id)', () => {
    it("TC-SES-013: sets session status to 'cancelled'", async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 5 });
      trxSessionRepo.update.mockResolvedValue({ affected: 1 });
      scheduleUpdateQB.execute.mockResolvedValue({ affected: 2 });

      await service.cancelSession(5);

      expect(trxSessionRepo.update).toHaveBeenCalledWith(5, {
        status: 'cancelled',
      });
    });

    it('TC-SES-014: cancels all non-completed schedules for session', async () => {
      trxSessionRepo.findOne.mockResolvedValue({ id: 5 });
      scheduleUpdateQB.execute.mockResolvedValue({ affected: 3 });

      await service.cancelSession(5);

      expect(scheduleUpdateQB.set).toHaveBeenCalledWith({
        attendance: 'cancelled',
      });
      expect(scheduleUpdateQB.where).toHaveBeenCalledWith(
        'sessionId = :sessionId',
        { sessionId: 5 },
      );
      expect(scheduleUpdateQB.andWhere).toHaveBeenCalledWith(
        'attendance != :completedStatus',
        { completedStatus: 'completed' },
      );
    });

    it('TC-SES-015: returns null when session does not exist', async () => {
      trxSessionRepo.findOne.mockResolvedValue(null);

      const result = await service.cancelSession(12345);
      expect(result).toBeNull();
    });
  });

  describe('addCoursePlus(dto)', () => {
    it('TC-SES-016: throws when session not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addCoursePlus({
          sessionId: 1,
          additionalClasses: 2,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("TC-SES-017: creates course plus with classNo, amount, status='unpaid'", async () => {
      sessionRepository.findOne.mockResolvedValue({
        id: 1,
        courseId: 10,
        studentId: 20,
        teacherId: 30,
        course: { title: 'Math' },
        classOption: { tuitionFee: 6000, classLimit: 6 },
      });
      coursePlusRepo.create.mockImplementation((payload) => payload);
      coursePlusRepo.save.mockResolvedValue({ id: 77 });
      scheduleRepo.create.mockImplementation((payload) => payload);
      scheduleRepo.save.mockResolvedValue({});

      await service.addCoursePlus({
        sessionId: 1,
        additionalClasses: 3,
      } as any);

      expect(coursePlusRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          classNo: 3,
          amount: 3000,
          status: 'unpaid',
        }),
      );
    });

    it("TC-SES-018: creates additionalClasses schedules with TBD placeholders", async () => {
      sessionRepository.findOne.mockResolvedValue({
        id: 1,
        courseId: 10,
        studentId: 20,
        teacherId: 30,
        course: { title: 'Math' },
        classOption: { tuitionFee: 6000, classLimit: 6 },
      });
      coursePlusRepo.create.mockImplementation((payload) => payload);
      coursePlusRepo.save.mockResolvedValue({ id: 77 });
      scheduleRepo.create.mockImplementation((payload) => payload);
      scheduleRepo.save.mockResolvedValue({});

      await service.addCoursePlus({
        sessionId: 1,
        additionalClasses: 2,
      } as any);

      expect(scheduleRepo.save).toHaveBeenCalledTimes(2);
      scheduleRepo.create.mock.calls.forEach(([payload]) => {
        expect(payload).toEqual(
          expect.objectContaining({
            coursePlusId: 77,
            startTime: 'TBD',
            endTime: 'TBD',
            room: 'TBD',
          }),
        );
      });
    });
  });

  describe('checkStudentHasWipSession(studentId, courseId)', () => {
    it('TC-SES-019: returns true when wip session exists', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1 }),
      };
      sessionRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkStudentHasWipSession(1, 2);
      expect(result).toBe(true);
    });

    it('TC-SES-020: returns false when no wip session exists', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      sessionRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkStudentHasWipSession(1, 2);
      expect(result).toBe(false);
    });
  });

  describe('swapSessionType(id, dto)', () => {
    it('TC-SES-021: throws NotFoundException when session not found', async () => {
      trxSessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.swapSessionType(1, { classOptionId: 9, newSchedules: [] } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('TC-SES-022: updates classOptionId and recreates schedules', async () => {
      trxSessionRepo.findOne.mockResolvedValue({
        id: 1,
        courseId: 10,
        studentId: 20,
        teacherId: 30,
      });
      trxSessionRepo.update.mockResolvedValue({ affected: 1 });
      trxScheduleRepo.delete.mockResolvedValue({ affected: 2 });
      trxScheduleRepo.create.mockImplementation((payload) => payload);
      trxScheduleRepo.save.mockResolvedValue([]);

      await service.swapSessionType(
        1,
        {
          classOptionId: 12,
          newSchedules: [
            {
              date: '2026-03-20',
              startTime: '10:00',
              endTime: '11:00',
              room: 'Room A',
              teacherId: 30,
            },
          ],
        } as any,
      );

      expect(trxSessionRepo.update).toHaveBeenCalledWith(1, { classOptionId: 12 });
      expect(trxScheduleRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 1,
          attendance: expect.any(Object),
        }),
      );
      expect(trxScheduleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 1,
          courseId: 10,
          studentId: 20,
          attendance: 'pending',
          verifyFb: false,
        }),
      );
    });
  });
});
