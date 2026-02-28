import app from './app.js';
import { logger } from './config/logger.js';
import { pool } from './config/database.js';
import { redis, checkRedisHealth } from './config/redis.js';
import { initializeQdrant } from './config/qdrant.js';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 初始化数据库连接池
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');

    // 初始化 Redis
    await redis.connect();
    const redisHealthy = await checkRedisHealth();
    if (!redisHealthy) {
      throw new Error('Redis health check failed');
    }
    logger.info('Redis connected');

    // 初始化 Qdrant
    await initializeQdrant();
    logger.info('Qdrant initialized');

    // 启动服务器
    app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await pool.end();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  await pool.end();
  await redis.quit();
  process.exit(0);
});

bootstrap();
