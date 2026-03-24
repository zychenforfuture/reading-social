import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendLikeNotification } from '../routes/comment.notify.js';
import { pool } from '../config/database.js';
import { createNotification } from '../utils/notifications.js';

vi.mock('../config/database.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../utils/notifications.js', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../config/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('comment.notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass blockHash parameter when creating like notification', async () => {
    (pool.query as any)
      .mockResolvedValueOnce({ rows: [{ username: 'verson' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'doc-1', title: 'Doc Title' }] });

    await sendLikeNotification({
      userId: 'user-verson',
      authorId: 'user-admin',
      content: '测试点赞内容',
      commentId: 'comment-1',
      blockHash: 'block-hash-1',
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE db.block_hash = $1'),
      ['block-hash-1']
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-admin',
        type: 'like',
        title: 'verson 点赞了你的评论',
      })
    );
  });
});
