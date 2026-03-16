import { AnalyticsService } from './analytics.service';

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

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const userRepository = mockRepository();
  const studentRepository = mockRepository();
  const teacherRepository = mockRepository();
  const courseRepository = mockRepository();
  const sessionRepository = mockRepository();
  const invoiceRepository = mockRepository();
  const receiptRepository = mockRepository();
  const scheduleRepository = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(
      userRepository as any,
      studentRepository as any,
      teacherRepository as any,
      courseRepository as any,
      sessionRepository as any,
      invoiceRepository as any,
      receiptRepository as any,
      scheduleRepository as any,
    );
  });

  it('TC-ANLYT-001: getDashboardOverview executes all core metric branches', async () => {
    const timeslotSpy = jest
      .spyOn(service, 'getTimeslotCount')
      .mockResolvedValue(7);
    const scheduleSpy = jest
      .spyOn(service, 'getScheduleCount')
      .mockResolvedValue(15);
    const courseTypeSpy = jest
      .spyOn(service, 'getCourseTypeCounts')
      .mockResolvedValue([]);
    const activeStudentSpy = jest
      .spyOn(service, 'getActiveStudentCount')
      .mockResolvedValue(9);

    await service.getDashboardOverview();

    expect(timeslotSpy).toHaveBeenCalled();
    expect(scheduleSpy).toHaveBeenCalled();
    expect(courseTypeSpy).toHaveBeenCalled();
    expect(activeStudentSpy).toHaveBeenCalled();
  });

  it('TC-ANLYT-002: teacher filter includes teacherClassCount equal to timeslotCount', async () => {
    jest.spyOn(service, 'getTimeslotCount').mockResolvedValue(7);
    jest.spyOn(service, 'getScheduleCount').mockResolvedValue(15);
    jest.spyOn(service, 'getCourseTypeCounts').mockResolvedValue([]);
    jest.spyOn(service, 'getActiveStudentCount').mockResolvedValue(9);

    const result = await service.getDashboardOverview({ teacherId: 3 } as any);

    expect(result.teacherClassCount).toBe(7);
    expect(result.timeslotCount).toBe(7);
  });

  it('TC-ANLYT-003: no teacher filter leaves teacherClassCount undefined', async () => {
    jest.spyOn(service, 'getTimeslotCount').mockResolvedValue(7);
    jest.spyOn(service, 'getScheduleCount').mockResolvedValue(15);
    jest.spyOn(service, 'getCourseTypeCounts').mockResolvedValue([]);
    jest.spyOn(service, 'getActiveStudentCount').mockResolvedValue(9);

    const result = await service.getDashboardOverview({});
    expect(result.teacherClassCount).toBeUndefined();
  });

  it('TC-ANLYT-004: getTimeslotCount selects COUNT(DISTINCT CONCAT(...))', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ count: '5' }),
    };
    scheduleRepository.createQueryBuilder.mockReturnValue(qb);

    const count = await service.getTimeslotCount();

    expect(qb.select).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(DISTINCT CONCAT'),
      'count',
    );
    expect(count).toBe(5);
  });
});
