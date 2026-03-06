import app from './app.js';
import { logger } from './config/logger.js';
import { pool } from './config/database.js';
import { redis, checkRedisHealth } from './config/redis.js';
import { initializeQdrant } from './config/qdrant.js';

const PORT = process.env.PORT || 3000;

/**
 * 启动前验证环境变量
 */
function validateStartupEnv() {
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`❌ 缺少必需的环境变量：${missing.join(', ')}`);
    process.exit(1);
  }

  // 生产环境检查 JWT_SECRET 强度
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'dev-secret-change-in-prod') {
      logger.error('❌ 生产环境必须修改 JWT_SECRET 默认值！');
      process.exit(1);
    }
    if (process.env.JWT_SECRET.length < 32) {
      logger.error('❌ JWT_SECRET 长度不足 32 字符，存在安全风险！');
      process.exit(1);
    }
  }

  logger.info('✅ 环境变量验证通过');
}

async function bootstrap() {
  try {
    // 启动前验证环境变量
    validateStartupEnv();

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
