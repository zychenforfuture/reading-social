import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock the auth middleware before importing app
vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user-id', email: 'test@example.com', isAdmin: false };
    next();
  },
  optionalAuth: (req: any, res: any, next: any) => {
    // For routes that don't require auth, user might be undefined
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    // For admin routes, we'll mock as if user is admin for testing
    req.user = { userId: 'test-admin-id', email: 'admin@example.com', isAdmin: true };
    next();
  },
  generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

import { pool } from '../config/database.js';
import app from '../app.js';

// Mock the database pool
vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Notification Routes', () => {
  const mockUserId = 'test-user-id';
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/notification/unread-count', () => {
    it('should return unread notification count', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [{ count: '5' }],
      });

      const res = await request(app)
        .get('/api/notification/unread-count')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 5 });
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [mockUserId]
      );
    });

    it('should handle database errors gracefully', async () => {
      (pool.query as any).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/notification/unread-count')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/notification/read-all', () => {
    it('should mark all notifications as read', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      const res = await request(app)
        .put('/api/notification/read-all')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'All notifications marked as read' });
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [mockUserId]
      );
    });

    it('should handle database errors gracefully', async () => {
      (pool.query as any).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/notification/read-all')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /api/notification/read-batch', () => {
    it('should mark batch notifications as read with valid input', async () => {
      (pool.query as any).mockResolvedValueOnce({});
      const notificationIds = ['id1', 'id2', 'id3'];

      const res = await request(app)
        .put('/api/notification/read-batch')
        .send({ ids: notificationIds })
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'OK' });
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE notifications SET is_read = true WHERE id = ANY($1::uuid[]) AND user_id = $2',
        [notificationIds, mockUserId]
      );
    });

    it('should reject invalid input (empty array)', async () => {
      const res = await request(app)
        .put('/api/notification/read-batch')
        .send({ ids: [] })
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation failed' });
    });

    it('should reject invalid input (non-UUID)', async () => {
      const res = await request(app)
        .put('/api/notification/read-batch')
        .send({ ids: ['invalid-id'] })
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation failed' });
    });
  });

  describe('POST /api/notification/delete-batch', () => {
    it('should delete batch notifications with valid input', async () => {
      (pool.query as any).mockResolvedValueOnce({});
      const notificationIds = ['id1', 'id2', 'id3'];

      const res = await request(app)
        .post('/api/notification/delete-batch')
        .send({ ids: notificationIds })
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'OK' });
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM notifications WHERE id = ANY($1::uuid[]) AND user_id = $2',
        [notificationIds, mockUserId]
      );
    });

    it('should reject invalid input', async () => {
      const res = await request(app)
        .post('/api/notification/delete-batch')
        .send({ ids: [] })
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Validation failed' });
    });
  });

  describe('GET /api/notification', () => {
    it('should get notifications list with default parameters', async () => {
      (pool.query as any).mockResolvedValueOnce({
        rows: [
          { id: 'notif1', type: 'reply', title: 'Test', is_read: false, created_at: new Date() },
        ],
      });
      (pool.query as any).mockResolvedValueOnce({
        rows: [{ count: '1' }],
      });

      const res = await request(app)
        .get('/api/notification')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        notifications: expect.arrayContaining([
          expect.objectContaining({ id: 'notif1', type: 'reply' }),
        ]),
        total: 1,
      });
    });

    it('should filter unread notifications when unread=true', async () => {
      (pool.query as any).mockResolvedValueOnce({ rows: [] });
      (pool.query as any).mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await request(app)
        .get('/api/notification?unread=true')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND is_read = false'),
        expect.any(Array)
      );
    });
  });

  describe('PUT /api/notification/:id/read', () => {
    it('should mark single notification as read', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      const res = await request(app)
        .put('/api/notification/test-id/read')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'OK' });
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
        ['test-id', mockUserId]
      );
    });
  });

  describe('DELETE /api/notification/:id', () => {
    it('should delete single notification', async () => {
      (pool.query as any).mockResolvedValueOnce({});

      const res = await request(app)
        .delete('/api/notification/test-id')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'OK' });
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        ['test-id', mockUserId]
      );
    });
  });
});