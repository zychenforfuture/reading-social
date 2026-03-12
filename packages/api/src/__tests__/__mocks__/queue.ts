/**
 * Mock BullMQ queue for unit tests
 * This replaces the real Redis-based queue with an in-memory mock
 */

export const documentQueue = {
  add: vi.fn(),
  getJobs: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  isEmpty: vi.fn(async () => true),
  count: vi.fn(async () => 0),
};

export const commentQueue = {
  add: vi.fn(),
  getJobs: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  isEmpty: vi.fn(async () => true),
  count: vi.fn(async () => 0),
};

export const mockAddJob = (queue: typeof documentQueue, jobName: string, data: any) => {
  queue.add.mockResolvedValue({ id: `job-${Date.now()}` });
};
