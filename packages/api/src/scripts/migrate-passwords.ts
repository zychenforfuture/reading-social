/**
 * 密码迁移脚本
 * 
 * 将使用 `$hashed$` 前缀的伪哈希密码迁移为 bcrypt 哈希
 * 
 * 使用方法:
 *   pnpm --filter @collab/api tsx src/scripts/migrate-passwords.ts
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

async function migratePasswords() {
  try {
    // 查找所有使用旧伪哈希格式的密码
    const result = await pool.query(
      'SELECT id, email, username, password_hash FROM users WHERE password_hash LIKE \'$hashed$%\''
    );

    if (result.rows.length === 0) {
      logger.info('✅ No passwords to migrate. All users already have bcrypt hashes.');
      return;
    }

    logger.info(`📦 Found ${result.rows.length} users with legacy password hashes`);

    let migrated = 0;
    let failed = 0;

    for (const user of result.rows) {
      try {
        // 提取明文密码（去掉 $hashed$ 前缀）
        const plainPassword = user.password_hash.replace('$hashed$', '');
        
        // 生成 bcrypt 哈希
        const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
        
        // 更新数据库
        await pool.query(
          'UPDATE users SET password_hash = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );

        migrated++;
        logger.info(`✅ Migrated: ${user.email} (${user.username})`);
      } catch (err) {
        failed++;
        logger.error(`❌ Failed to migrate ${user.email}:`, err);
      }
    }

    logger.info('=================================');
    logger.info('Migration Complete!');
    logger.info(`✅ Successfully migrated: ${migrated}`);
    logger.info(`❌ Failed: ${failed}`);
    logger.info('=================================');

  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行迁移
logger.info('🚀 Starting password migration...');
migratePasswords();
