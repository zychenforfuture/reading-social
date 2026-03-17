/**
 * 点赞计数器 - 使用 Redis 实现原子操作（借鉴起点读书方案）
 *
 * 架构设计：
 * 1. 前端防抖聚合：50 次点击 → 1 次请求
 * 2. Redis 原子计数：INCR/DECR 保证并发安全
 * 3. 异步持久化：setImmediate 削峰填谷，批量写入 MySQL
 */

import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

// 缓冲池：批量写入 MySQL
const buffer = new Map<string, { commentId: string; userId: string; liked: boolean; timestamp: number }>();
let flushScheduled = false;

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

/**
 * 批量写入 MySQL
 */
async function flushBuffer(): Promise<void> {
  if (buffer.size === 0) {
    flushScheduled = false;
    return;
  }

  const operations = Array.from(buffer.values());
  const bufferCopy = new Map(buffer);
  buffer.clear();
  flushScheduled = false;

  try {
    const { pool } = await import('../config/database.js');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 按 commentId 分组，合并相同评论的操作
      const byComment = new Map<string, typeof operations>();
      for (const op of operations) {
        if (!byComment.has(op.commentId)) {
          byComment.set(op.commentId, []);
        }
        byComment.get(op.commentId)!.push(op);
      }

      for (const [commentId, ops] of byComment.entries()) {
        // 计算净变化
        let netChange = 0;
        let finalLikedState: boolean | null = null;

        for (const op of ops) {
          if (op.liked) {
            netChange++;
            finalLikedState = true;
          } else {
            netChange--;
            finalLikedState = false;
          }
        }

        // 如果净变化不为 0，更新数据库
        if (netChange !== 0 && finalLikedState !== null) {
          const latestOp = ops[ops.length - 1];

          if (finalLikedState) {
            // 最终状态是已点赞，插入记录
            await client.query(
              `INSERT INTO comment_likes (comment_id, user_id, created_at)
               VALUES ($1, $2, to_timestamp($3 / 1000.0))
               ON CONFLICT (comment_id, user_id) DO UPDATE SET created_at = EXCLUDED.created_at`,
              [commentId, latestOp.userId, latestOp.timestamp]
            );
          } else {
            // 最终状态是取消，删除记录
            await client.query(
              'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
              [commentId, latestOp.userId]
            );
          }

          // 更新点赞数
          await client.query(
            `UPDATE comments SET like_count = GREATEST(0, like_count + $1) WHERE id = $2`,
            [netChange, commentId]
          );

          logger.info(`Batch persisted: comment ${commentId.substring(0, 8)}..., net change: ${netChange}`);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to flush like buffer:', error);
    // 重新加入缓冲池（简化处理：不重试，只记录）
    for (const [key, op] of bufferCopy.entries()) {
      if (!buffer.has(key)) {
        buffer.set(key, op);
      }
    }
  }

  // 如果还有剩余，继续调度
  if (buffer.size > 0 && !flushScheduled) {
    scheduleFlush();
  }
}

/**
 * 定时刷新缓冲池
 */
function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;

  setTimeout(() => {
    flushBuffer().catch(err => logger.error('Scheduled flush failed:', err));
  }, BATCH_DELAY_MS);
}

/**
 * 原子增加/取消点赞，返回最终状态
 *
 * @param commentId 评论 ID
 * @param userId 用户 ID
 * @returns { liked: boolean, likeCount: number }
 */
export async function atomicToggleLike(
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const likeKey = `like:comment:${commentId}`;
  const userLikeKey = `user:like:comment:${commentId}:user:${userId}`;

  // Lua 脚本保证原子性（类似起点的做法）
  // Redis 单线程执行，50 并发也会排队处理，不会出现竞态条件
  const luaScript = `
    local hasLiked = redis.call('GET', KEYS[2])
    if hasLiked == '1' then
      -- 已点赞，执行取消
      redis.call('DEL', KEYS[2])
      local newCount = redis.call('DECR', KEYS[1])
      return { 0, tonumber(newCount) }
    else
      -- 未点赞，执行点赞
      redis.call('SET', KEYS[2], '1')
      local newCount = redis.call('INCR', KEYS[1])
      return { 1, tonumber(newCount) }
    end
  `;

  const result = await redis.eval(luaScript, 2, likeKey, userLikeKey);
  const liked = (result as [number, number])[0] === 1;
  const likeCount = (result as [number, number])[1];

  // 异步持久化到 MySQL（削峰填谷）
  // 使用 setImmediate 避免阻塞响应
  setImmediate(() => {
    buffer.set(`${commentId}:${userId}`, { commentId, userId, liked, timestamp: Date.now() });

    // 如果缓冲池已满，立即刷新
    if (buffer.size >= BATCH_SIZE) {
      if (flushScheduled) {
        clearTimeout((globalThis as any).__likeFlushTimeout);
      }
      flushBuffer().catch(err => logger.error('Immediate flush failed:', err));
    } else {
      // 否则定时刷新
      scheduleFlush();
    }
  });

  return { liked, likeCount };
}

/**
 * 从 Redis 读取当前点赞数（用于兜底或校准）
 */
export async function getLikeCountFromRedis(commentId: string): Promise<number> {
  const likeKey = `like:comment:${commentId}`;
  const count = await redis.get(likeKey);
  return count ? parseInt(count, 10) : 0;
}

/**
 * 校准 Redis 与 MySQL 的点赞数（定时任务或按需调用）
 * 以 MySQL 为准，更新 Redis 缓存
 */
export async function syncLikeCountWithDb(commentId: string): Promise<void> {
  try {
    const { pool } = await import('../config/database.js');
    const result = await pool.query(
      'SELECT like_count FROM comments WHERE id = $1',
      [commentId]
    );

    if (result.rows.length > 0) {
      const dbCount = result.rows[0].like_count;
      const likeKey = `like:comment:${commentId}`;
      await redis.set(likeKey, dbCount.toString());
      logger.info(`Synced like count for comment ${commentId}: ${dbCount}`);
    }
  } catch (error) {
    logger.error('Failed to sync like count:', error);
  }
}

/**
 * 检查 Redis 连接状态
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
