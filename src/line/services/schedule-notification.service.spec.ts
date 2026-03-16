import { CronExpression } from '@nestjs/schedule';
import { ScheduleNotificationService } from './schedule-notification.service';

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

describe('ScheduleNotificationService', () => {
  let service: ScheduleNotificationService;
  const scheduleRepository = mockRepository();
  const parentRepository = mockRepository();
  const parentStudentRepository = mockRepository();
  const lineMessagingService = {
    sendScheduleNotification: jest.fn(),
  };
  const scheduleService = {
    updateSchedule: jest.fn(),
  };
  const notificationService = {
    create: jest.fn(),
    createForRole: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScheduleNotificationService(
      scheduleRepository as any,
      parentRepository as any,
      parentStudentRepository as any,
      lineMessagingService as any,
      scheduleService as any,
      notificationService as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('TC-NOTIF-001: queries schedules for target date and pending attendance', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-16T00:00:00.000Z'));
    scheduleRepository.find.mockResolvedValue([]);
    const expectedDate = new Date(
      Date.now() + 3 * 86400000,
    ).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

    await service.sendNotificationsForDaysOffset(3);

    expect(scheduleRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date: expectedDate,
          attendance: 'pending',
        },
      }),
    );
  });

  it('TC-NOTIF-002: sends notifications only to linked parents (lineId present)', async () => {
    const schedule = {
      id: 1,
      studentId: 100,
      courseId: 200,
      date: new Date('2026-03-19'),
      startTime: '10:00',
      endTime: '11:00',
      room: 'Room A',
      student: { name: 'Kid A', profilePicture: null },
      course: { title: 'Math' },
      teacher: { name: 'Teacher A' },
      session: { id: 300 },
    };

    scheduleRepository.find
      .mockResolvedValueOnce([schedule]) // main query
      .mockResolvedValueOnce([schedule]); // attendance stats query

    parentStudentRepository.find.mockResolvedValue([
      { parent: { id: 1, lineId: 'Uabc' } },
      { parent: { id: 2, lineId: null } },
    ]);

    await service.sendNotificationsForDaysOffset(3);

    expect(lineMessagingService.sendScheduleNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(lineMessagingService.sendScheduleNotification).toHaveBeenCalledWith(
      'Uabc',
      expect.any(Object),
    );
  });

  it('TC-NOTIF-003: exits early when no eligible schedules exist', async () => {
    scheduleRepository.find.mockResolvedValue([]);

    await service.sendNotificationsForDaysOffset(3);

    expect(lineMessagingService.sendScheduleNotification).not.toHaveBeenCalled();
    expect(parentStudentRepository.find).not.toHaveBeenCalled();
  });

  it('TC-NOTIF-004: notification payload includes student, course, date, time, and room', async () => {
    const schedule = {
      id: 10,
      studentId: 1,
      courseId: 2,
      date: new Date('2026-03-19'),
      startTime: '13:00',
      endTime: '15:00',
      room: 'Room B',
      student: { name: 'Student X', profilePicture: 'pic.jpg' },
      course: { title: 'Science' },
      teacher: { name: 'Teacher Z' },
      session: { id: 9 },
    };

    scheduleRepository.find
      .mockResolvedValueOnce([schedule])
      .mockResolvedValueOnce([
        { attendance: 'present' },
        { attendance: 'confirmed' },
        { attendance: 'cancelled' },
      ]);

    parentStudentRepository.find.mockResolvedValue([
      { parent: { id: 5, lineId: 'Uline-5' } },
    ]);

    await service.sendNotificationsForDaysOffset(3);

    const [, payload] = lineMessagingService.sendScheduleNotification.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        studentName: 'Student X',
        courseName: 'Science',
        startTime: '13:00',
        endTime: '15:00',
        room: 'Room B',
      }),
    );
    expect(payload.date).toEqual(expect.any(String));
  });

  it('TC-NOTIF-005: sendDailyNotifications has Cron EVERY_DAY_AT_9AM metadata', () => {
    const options = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      ScheduleNotificationService.prototype.sendDailyNotifications,
    );

    expect(options).toBeDefined();
    expect(options.cronTime).toBe(CronExpression.EVERY_DAY_AT_9AM);
  });
});
