import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 30,  // 增加最大连接数，大文档处理需要更多并发
  idleTimeoutMillis: 60000, // 增加到 60 秒，避免长查询被断开
  connectionTimeoutMillis: 10000, // 增加到 10 秒
  statement_timeout: 300000, // 5 分钟语句超时（大文档批量插入需要时间）
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
