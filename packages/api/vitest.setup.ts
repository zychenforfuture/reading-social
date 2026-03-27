import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function setup() {
  console.log('Running database migrations for tests...');
  try {
    const { stdout, stderr } = await execAsync('npm run db:migrate');
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration setup failed:', error);
    // 如果 db-migrate 失败，当前没有可靠的 init.sql 回退，实现前先直接失败
    console.log('Note: tests require database to be initialized via docker/postgres/init.sql');
    throw error;
  }
}
