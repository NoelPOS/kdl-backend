import { BadRequestException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

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

const buildConflictQueryBuilder = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
});

describe('ScheduleService', () => {
  let service: ScheduleService;

  const scheduleRepo = mockRepository();
  const teacherRepo = mockRepository();
  const teacherAbsenceRepo = mockRepository();
  const notificationService = {
    createForRole: jest.fn(),
  };
  const parentService = {
    getParentsByStudentId: jest.fn().mockResolvedValue([]),
  };
  const lineMessagingService = {
    sendFeedbackAvailableNotification: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScheduleService(
      scheduleRepo as any,
      teacherRepo as any,
      teacherAbsenceRepo as any,
      notificationService as any,
      parentService as any,
      lineMessagingService as any,
    );
  });

  describe('checkConflict(dto)', () => {
    const baseDto = {
      date: '2026-03-16',
      startTime: '11:00',
      endTime: '13:00',
      room: 'Room A',
      teacherId: 1,
      studentId: 1,
    };

    beforeEach(() => {
      teacherRepo.findOne.mockResolvedValue(null);
      teacherAbsenceRepo.findOne.mockResolvedValue(null);
    });

    it('TC-SCH-001: returns null when no conflicting schedule exists', async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict(baseDto as any);
      expect(result).toBeNull();
    });

    it("TC-SCH-002: returns conflictType 'room' for overlapping room usage", async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 10,
        room: 'Room A',
        startTime: '10:00',
        endTime: '12:00',
        teacher: { id: 99, name: 'Teacher B' },
        student: { id: 999, name: 'Student Z' },
        course: { title: 'Math' },
      });
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict(baseDto as any);
      expect(result?.conflictType).toBe('room');
    });

    it("TC-SCH-003: returns conflictType 'teacher' when teacher is already booked", async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 11,
        room: 'Room X',
        startTime: '10:00',
        endTime: '12:00',
        teacher: { id: 1, name: 'Teacher A' },
        student: { id: 999, name: 'Student Z' },
        course: { title: 'Science' },
      });
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict(baseDto as any);
      expect(result?.conflictType).toBe('teacher');
    });

    it('TC-SCH-004: applies excludeId condition to avoid self-conflict', async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict({
        ...baseDto,
        excludeId: 10,
      } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('s.id != :excludeId', {
        excludeId: 10,
      });
      expect(result).toBeNull();
    });

    it('TC-SCH-005: returns null for non-overlapping adjacent times', async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue(null);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict({
        ...baseDto,
        startTime: '10:00',
        endTime: '11:00',
      } as any);

      expect(result).toBeNull();
    });

    it("TC-SCH-006: returns conflictType 'all' when room, teacher, and student all conflict", async () => {
      const qb = buildConflictQueryBuilder();
      qb.getOne.mockResolvedValue({
        id: 20,
        room: 'Room A',
        startTime: '10:00',
        endTime: '12:00',
        teacher: { id: 1, name: 'Teacher A' },
        student: { id: 1, name: 'Student A' },
        course: { title: 'Math' },
      });
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.checkConflict(baseDto as any);
      expect(result?.conflictType).toBe('all');
    });
  });

  describe('updateSchedule(id, dto, user)', () => {
    const existingSchedule = {
      id: 1,
      sessionId: 10,
      studentId: 100,
      teacherId: 2,
      courseId: 200,
      attendance: 'pending',
      classNumber: 1,
      date: null,
      startTime: '10:00',
      endTime: '11:00',
      room: 'Room A',
      student: { name: 'Student A' },
      teacher: { name: 'Teacher A' },
      course: { title: 'Math' },
    };

    it("TC-SCH-007: teacher cannot set verifyFb=true without feedback update", async () => {
      scheduleRepo.findOne.mockResolvedValue(existingSchedule);

      await expect(
        service.updateSchedule(1, { verifyFb: true } as any, {
          role: 'teacher',
          id: 2,
          name: 'Teacher A',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("TC-SCH-008: teacher cannot update another teacher's schedule feedback", async () => {
      scheduleRepo.findOne.mockResolvedValue(existingSchedule);

      await expect(
        service.updateSchedule(1, { feedback: 'Great progress' } as any, {
          role: 'teacher',
          id: 1,
          name: 'Teacher B',
        }),
      ).rejects.toThrow(/only update feedback for their own schedules/i);
    });

    it("TC-SCH-009: attendance changed to cancelled triggers replacement schedule creation", async () => {
      scheduleRepo.findOne
        .mockResolvedValueOnce(existingSchedule)
        .mockResolvedValueOnce({ ...existingSchedule, attendance: 'cancelled' });
      scheduleRepo.update.mockResolvedValue({ affected: 1 });
      const replacementSpy = jest
        .spyOn(service as any, 'createReplacementSchedule')
        .mockResolvedValue(undefined);

      await service.updateSchedule(1, { attendance: 'cancelled' } as any, {
        role: 'admin',
        id: 999,
        name: 'Admin',
      });

      expect(replacementSpy).toHaveBeenCalled();
    });

    it('TC-SCH-010: non-cancel attendance update does not create replacement schedule', async () => {
      scheduleRepo.findOne
        .mockResolvedValueOnce(existingSchedule)
        .mockResolvedValueOnce({ ...existingSchedule, attendance: 'attended' });
      scheduleRepo.update.mockResolvedValue({ affected: 1 });
      const replacementSpy = jest
        .spyOn(service as any, 'createReplacementSchedule')
        .mockResolvedValue(undefined);

      await service.updateSchedule(1, { attendance: 'attended' } as any, {
        role: 'admin',
        id: 999,
        name: 'Admin',
      });

      expect(replacementSpy).not.toHaveBeenCalled();
    });

    it("TC-SCH-011: generateConflictWarning formats room conflict text", () => {
      const warning = (service as any).generateConflictWarning({
        conflictType: 'room',
        room: 'Room A',
        courseTitle: 'Math',
        time: '10:00-11:00',
      });

      expect(warning).toBe(
        'Room A is not available. There is a Math class at 10:00-11:00.',
      );
    });

    it('TC-SCH-012: admin can update feedback for any teacher schedule', async () => {
      scheduleRepo.findOne
        .mockResolvedValueOnce({ ...existingSchedule, teacherId: 5 })
        .mockResolvedValueOnce({ ...existingSchedule, teacherId: 5, feedback: 'Updated' });
      scheduleRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateSchedule(
        1,
        { feedback: 'Updated by admin' } as any,
        { role: 'admin', id: 1, name: 'Admin User' },
      );

      expect(scheduleRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          feedback: 'Updated by admin',
          feedbackModifiedByName: 'Admin User',
        }),
      );
    });
  });

  describe('create(dto)', () => {
    it('TC-SCH-013: creates and saves schedule from DTO', async () => {
      const dto = {
        sessionId: 1,
        courseId: 2,
        studentId: 3,
        teacherId: 4,
        date: '2026-03-16',
        startTime: '10:00',
        endTime: '12:00',
        room: 'Room A',
        attendance: 'pending',
      };
      scheduleRepo.create.mockImplementation((payload) => payload);
      scheduleRepo.save.mockImplementation(async (payload) => payload);

      const result = await service.create(dto as any);

      expect(scheduleRepo.create).toHaveBeenCalledWith(dto);
      expect(scheduleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 1,
          room: 'Room A',
          startTime: '10:00',
          endTime: '12:00',
        }),
      );
      expect(result).toEqual(expect.objectContaining({ sessionId: 1 }));
    });
  });
});
