/**
 * JWT 鉴权测试脚本
 * 
 * 测试登录、token 生成和验证流程
 * 
 * 使用方法:
 *   pnpm --filter @collab/api tsx src/scripts/test-auth.ts
 */

import { generateToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

console.log('🔐 JWT 鉴权测试\n');
console.log('=================================');

// 测试 1: 生成 token
console.log('\n📝 测试 1: 生成 JWT token');
const testPayload = {
  userId: 'test-user-123',
  email: 'test@example.com',
  isAdmin: false,
};

const token = generateToken(testPayload);
console.log(`✅ Token 生成成功:`);
console.log(`   ${token.substring(0, 50)}...`);

// 测试 2: 验证 token
console.log('\n📝 测试 2: 验证 JWT token');
try {
  const decoded = jwt.verify(token, JWT_SECRET) as typeof testPayload;
  console.log(`✅ Token 验证成功:`);
  console.log(`   userId: ${decoded.userId}`);
  console.log(`   email: ${decoded.email}`);
  console.log(`   isAdmin: ${decoded.isAdmin}`);
} catch (err) {
  console.log(`❌ Token 验证失败:`, err);
}

// 测试 3: token 过期时间
console.log('\n📝 测试 3: 检查 token 过期时间');
const decoded = jwt.decode(token, { complete: true });
if (decoded && 'payload' in decoded && typeof decoded.payload === 'object' && decoded.payload.exp) {
  const expTime = new Date((decoded.payload as any).exp * 1000);
  const now = new Date();
  const hoursUntilExpiry = Math.floor(((decoded.payload as any).exp * 1000 - now.getTime()) / (1000 * 60 * 60));
  console.log(`✅ Token 过期时间：${expTime.toLocaleString('zh-CN')}`);
  console.log(`   约 ${hoursUntilExpiry} 小时后过期`);
} else {
  console.log(`❌ 无法解析过期时间`);
}

// 测试 4: 无效 token
console.log('\n📝 测试 4: 验证无效 token');
try {
  jwt.verify('invalid_token_here', JWT_SECRET);
  console.log(`❌ 应该抛出错误但未抛出`);
} catch (err) {
  console.log(`✅ 正确拒绝无效 token`);
}

console.log('\n=================================');
console.log('✅ 所有测试完成!\n');
