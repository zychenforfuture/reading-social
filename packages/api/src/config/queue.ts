import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);

// BullMQ 需要 host/port 格式（不支持直接传 URL）
export const documentQueue = new Queue('document-processing', {
  connection: {
    host: url.hostname,
    port: parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
  },
  defaultJobOptions: {
    attempts: 3,          // 失败最多重试 3 次
    backoff: {
      type: 'exponential',
      delay: 5000,        // 第一次重试等 5s，之后指数增长
    },
    removeOnComplete: 100, // 只保留最近 100 条完成记录
    removeOnFail: 200,     // 保留最近 200 条失败记录供排查
  },
});

documentQueue.on('error', (err) => {
  console.error('Document queue error:', err);
});
