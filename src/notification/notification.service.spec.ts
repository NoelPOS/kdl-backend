import { NotificationService } from './notification.service';

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

describe('NotificationService', () => {
  let service: NotificationService;
  const notificationRepo = mockRepository();
  const userRepo = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(notificationRepo as any, userRepo as any);
  });

  it("TC-NOTI-001: createForRole('registrar') saves one notification per matching user", async () => {
    const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
    userRepo.find.mockResolvedValue(users);
    notificationRepo.create.mockImplementation((payload) => payload);
    notificationRepo.save.mockResolvedValue([]);

    await service.createForRole(
      'registrar',
      'New Feedback',
      'Please review',
      'feedback_submitted',
    );

    expect(userRepo.find).toHaveBeenCalledWith({
      where: { role: 'registrar' },
    });
    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    expect(notificationRepo.save.mock.calls[0][0]).toHaveLength(3);
  });

  it('TC-NOTI-002: logs warning and skips save when no users for role', async () => {
    const warnSpy = jest.spyOn((service as any).logger, 'warn');
    userRepo.find.mockResolvedValue([]);

    await service.createForRole(
      'registrar',
      'New Feedback',
      'Please review',
      'feedback_submitted',
    );

    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('TC-NOTI-003: create() saves notification with isRead=false', async () => {
    notificationRepo.create.mockImplementation((payload) => payload);
    notificationRepo.save.mockImplementation(async (payload) => payload);

    const result = await service.create(
      99,
      'Schedule Confirmed',
      'Parent confirmed class',
      'schedule_confirmed',
      { scheduleId: 10 },
    );

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 99,
        title: 'Schedule Confirmed',
        type: 'schedule_confirmed',
        isRead: false,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ isRead: false }));
  });
});
