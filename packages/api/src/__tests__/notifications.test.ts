import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotification } from '../utils/notifications.js';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// Mock the database pool and logger
vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('Notifications Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should successfully create a notification', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      await createNotification({
        userId: 'test-user-id',
        type: 'reply',
        title: 'Test Notification',
        content: 'This is a test notification',
        data: { documentId: 'doc-123' },
      });

      expect(pool.query).toHaveBeenCalledWith(
        `INSERT INTO notifications (user_id, type, title, content, data)
       VALUES ($1, $2, $3, $4, $5)`,
        [
          'test-user-id',
          'reply',
          'Test Notification',
          'This is a test notification',
          '{"documentId":"doc-123"}',
        ]
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle missing content gracefully', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      await createNotification({
        userId: 'test-user-id',
        type: 'mention',
        title: 'Mention Notification',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'test-user-id',
          'mention',
          'Mention Notification',
          null,
          '{}',
        ])
      );
    });

    it('should handle missing data gracefully', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      await createNotification({
        userId: 'test-user-id',
        type: 'like',
        title: 'Like Notification',
        content: 'Someone liked your comment',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'test-user-id',
          'like',
          'Like Notification',
          'Someone liked your comment',
          '{}',
        ])
      );
    });

    it('should log error but not throw when database fails', async () => {
      const mockError = new Error('Database connection failed');
      (pool.query as any).mockRejectedValueOnce(mockError);

      await createNotification({
        userId: 'test-user-id',
        type: 'reply',
        title: 'Test Notification',
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to create notification:', mockError);
      // Should not throw - fire-and-forget behavior
    });
  });
});