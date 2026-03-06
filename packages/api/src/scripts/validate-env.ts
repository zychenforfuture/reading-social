/**
 * 环境变量验证脚本
 * 
 * 启动前检查必需的环境变量是否已配置
 * 
 * 使用方法:
 *   pnpm --filter @collab/api tsx src/scripts/validate-env.ts
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
];

const sensitiveEnvVars = [
  'DB_PASSWORD',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'SMTP_PASS',
];

function validateEnv() {
  console.log('🔍 验证环境变量...\n');
  
  let hasError = false;
  let warnings = 0;

  // 检查必需的环境变量
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (!value) {
      console.error(`❌ 错误：必需的环境变量 ${envVar} 未设置`);
      hasError = true;
    } else {
      console.log(`✅ ${envVar} 已配置`);
    }
  }

  // 检查敏感变量是否使用默认值
  if (process.env.JWT_SECRET === 'dev-secret-change-in-prod') {
    console.error(`❌ 错误：JWT_SECRET 使用默认值，生产环境必须修改！`);
    hasError = true;
  }

  if (process.env.NODE_ENV === 'production') {
    // 生产环境检查
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      console.error(`❌ 错误：JWT_SECRET 长度不足 32 字符，存在安全风险！`);
      hasError = true;
    }

    if (!process.env.DATABASE_URL?.includes('sslmode') && !process.env.DATABASE_URL?.includes('localhost')) {
      console.warn(`⚠️  警告：生产环境数据库连接未启用 SSL`);
      warnings++;
    }
  }

  // 检查 SMTP 配置（用于邮件发送）
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`⚠️  警告：SMTP 配置不完整，邮件功能将不可用`);
    warnings++;
  }

  console.log('\n=================================');
  
  if (hasError) {
    console.error('❌ 环境变量验证失败，请修复后重新启动');
    console.error('=================================\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`✅ 验证通过（${warnings} 个警告）`);
    console.log('=================================\n');
  } else {
    console.log('✅ 所有环境变量配置正确');
    console.log('=================================\n');
  }
}

validateEnv();
