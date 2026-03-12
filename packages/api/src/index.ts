import app from './app.js';
import { logger } from './config/logger.js';
import { pool } from './config/database.js';
import { redis, checkRedisHealth } from './config/redis.js';
import { initializeQdrant } from './config/qdrant.js';

const PORT = process.env.PORT || 3000;

/**
 * 计算字符串的熵值（估算）
 */
function estimateEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

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

  // 所有环境都检查 JWT_SECRET 强度（不只是生产环境）
  const jwtSecret = process.env.JWT_SECRET!;

  if (jwtSecret === 'dev-secret-change-in-prod') {
    logger.error('❌ JWT_SECRET 不能使用默认值 dev-secret-change-in-prod！');
    process.exit(1);
  }

  if (jwtSecret.length < 32) {
    logger.error('❌ JWT_SECRET 长度不足 32 字符，存在安全风险！');
    process.exit(1);
  }

  // 检查熵值（至少 3.5 比特/字符）
  const entropy = estimateEntropy(jwtSecret);
  if (entropy < 3.5) {
    logger.error(`❌ JWT_SECRET 熵值过低 (${entropy.toFixed(2)} < 3.5)，请使用更随机的密钥！`);
    logger.error('💡 建议：使用 openssl rand -hex 32 生成高熵密钥');
    process.exit(1);
  }

  // 检查是否包含常见弱模式
  const weakPatterns = ['123456', 'abcdef', 'password', 'secret', 'qwerty', 'admin'];
  const lowerSecret = jwtSecret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      logger.error(`❌ JWT_SECRET 包含弱模式 "${pattern}"，存在安全风险！`);
      process.exit(1);
    }
  }

  logger.info('✅ 环境变量验证通过（JWT_SECRET 熵值：' + entropy.toFixed(2) + '）');
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
