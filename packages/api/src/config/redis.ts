import Redis, { type RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// 解析 Redis URL 获取密码
const url = new URL(redisUrl);
const password = url.password || undefined;

const redisConfig: RedisOptions = {
  host: url.hostname,
  port: parseInt(url.port, 10) || 6379,
  password: password || undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

export const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

// 健康检查
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
