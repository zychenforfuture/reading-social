import { Queue, Worker } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);

const connectionConfig = {
  host: url.hostname,
  port: parseInt(url.port, 10) || 6379,
  password: url.password || undefined,
};

// 通知队列
export const notificationQueue = new Queue('notifications', {
  connection: connectionConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// 通知处理器类型
export interface NotificationJobData {
  userId: string;
  type: 'reply' | 'mention' | 'system' | 'like';
  title: string;
  content?: string;
  data?: Record<string, any>;
  sendTelegram?: boolean;  // 是否同时发送 Telegram 通知
}

// Worker 处理器（可选，如果需要后台处理 Telegram 推送等）
export const notificationWorker = new Worker('notifications', async (job) => {
  const data: NotificationJobData = job.data;
  
  // 这里可以扩展 Telegram 推送、邮件通知等
  if (data.sendTelegram && process.env.TELEGRAM_BOT_TOKEN) {
    // TODO: 实现 Telegram 推送
    console.log(`[Telegram] Would send notification to user ${data.userId}: ${data.title}`);
  }
  
  return { processed: true };
}, {
  connection: connectionConfig,
});

notificationWorker.on('error', (err) => {
  console.error('Notification worker error:', err);
});

notificationQueue.on('error', (err) => {
  console.error('Notification queue error:', err);
});
