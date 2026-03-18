import { Pool, PoolConfig } from 'pg';

// 清理可能来自外部的占位环境变量，避免向 pg 传入字面字符串 'undefined' 或其它非字符串密码
if (process.env.PGPASSWORD === 'undefined' || process.env.PGPASSWORD === 'null') {
  delete process.env.PGPASSWORD;
}

// 解析并清理 DATABASE_URL，防止出现 'undefined' 字符串被当成密码导致 pg 抛错
function buildPoolConfig(): PoolConfig {
  const raw = process.env.DATABASE_URL;
  const baseConfig: PoolConfig = {
    max: 30,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    // 注意：statement_timeout 作为连接参数传入需要使用 connectionParameters 或在 SQL 层设置，保留客户端超时设置
  };

  if (!raw) {
    // 在本地测试环境没有设置 DATABASE_URL 时，返回基础配置（连接创建时会失败并由测试脚本提供提示）
    return baseConfig;
  }

  try {
    const u = new URL(raw);
    const user = typeof u.username === 'string' && u.username.length > 0 ? u.username : undefined;
    const rawPassword = typeof u.password === 'string' && u.password.length > 0 ? u.password : undefined;
    const password = rawPassword && rawPassword !== 'undefined' && rawPassword !== 'null' ? rawPassword : undefined;
    const host = u.hostname || undefined;
    const port = u.port ? parseInt(u.port, 10) : undefined;
    const database = u.pathname ? u.pathname.replace(/^\//, '') : undefined;

    // 如果解析成功，优先使用分项配置，避免向 pg 传递非字符串或字面 'undefined'
    return {
      ...baseConfig,
      host,
      port,
      user,
      password,
      database,
    };
  } catch (err) {
    // 遇到解析错误则回退到直接使用 connectionString
    return { ...baseConfig, connectionString: raw };
  }
}

const poolConfig: PoolConfig = buildPoolConfig();

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // 在测试/开发环境中不要直接退出整个进程，允许测试框架捕获错误并展示失败详情。
  // 在生产环境中仍建议监控并重启服务。
});

export async function query<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
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
