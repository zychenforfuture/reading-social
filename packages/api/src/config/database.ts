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
  // 在测试/开发环境中不要直接退出整个进程，允许测试框架捕获错误并展示失败详情。
  // 在生产环境中仍建议监控并重启服务。
});

export async function query<T>(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
