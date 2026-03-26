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
    throw error;
  }
}
