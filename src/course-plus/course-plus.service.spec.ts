import { CoursePlusService } from './course-plus.service';

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

describe('CoursePlusService', () => {
  let service: CoursePlusService;
  const coursePlusRepo = mockRepository();
  const scheduleRepo = mockRepository();
  const sessionRepo = mockRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoursePlusService(
      coursePlusRepo as any,
      scheduleRepo as any,
      sessionRepo as any,
    );
  });

  it('TC-CPLUS-001: create() creates a coursePlus and one schedule per dto.schedules entry', async () => {
    coursePlusRepo.create.mockImplementation((payload) => ({ id: 88, ...payload }));
    coursePlusRepo.save.mockResolvedValue({ id: 88, sessionId: 10 });
    scheduleRepo.create.mockImplementation((payload) => payload);
    scheduleRepo.save.mockImplementation(async (payload) => payload);

    const dto = {
      sessionId: 10,
      classNo: 2,
      amount: 3000,
      status: 'unpaid',
      schedules: [
        {
          date: '2026-03-20',
          startTime: '10:00',
          endTime: '11:00',
          room: 'Room A',
        },
        {
          date: '2026-03-21',
          startTime: '10:00',
          endTime: '11:00',
          room: 'Room B',
        },
      ],
    };

    await service.create(dto as any);

    expect(coursePlusRepo.save).toHaveBeenCalledTimes(1);
    expect(scheduleRepo.save).toHaveBeenCalledTimes(2);
    scheduleRepo.create.mock.calls.forEach(([payload]) => {
      expect(payload).toEqual(
        expect.objectContaining({
          sessionId: 10,
          coursePlusId: 88,
        }),
      );
    });
  });

  it("TC-CPLUS-002: updateStatus(id, 'paid') updates status to paid", async () => {
    coursePlusRepo.findOne
      .mockResolvedValueOnce({ id: 7, status: 'unpaid' })
      .mockResolvedValueOnce({ id: 7, status: 'paid' });

    const result = await service.updateStatus(7, 'paid');

    expect(coursePlusRepo.update).toHaveBeenCalledWith(7, { status: 'paid' });
    expect(result).toEqual(expect.objectContaining({ status: 'paid' }));
  });

  it("TC-CPLUS-003: updateStatus(id, 'invalid') throws invalid status error", async () => {
    coursePlusRepo.findOne.mockResolvedValue({ id: 7, status: 'unpaid' });

    await expect(service.updateStatus(7, 'invalid')).rejects.toThrow(
      /Invalid status/i,
    );
  });

  it('TC-CPLUS-004: updateStatus throws when coursePlus is not found', async () => {
    coursePlusRepo.findOne.mockResolvedValue(null);

    await expect(service.updateStatus(7, 'paid')).rejects.toThrow(
      /not found/i,
    );
  });
});
