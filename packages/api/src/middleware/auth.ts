import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const JWT_EXPIRES_IN = '7d';

export interface AuthPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * 生成 JWT token
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 从请求中提取 token（支持 Bearer Header、Cookie、Query Param）
 * 优先级：Authorization Header > Cookie > Query Param
 */
function extractToken(req: Request): string | null {
  // 1. 尝试从 Authorization Header 获取
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. 尝试从 Cookie 获取
  const cookieToken = req.cookies?.['auth_token'];
  if (cookieToken) {
    return cookieToken;
  }

  // 3. 尝试从 Query Param 获取（仅用于 SSE 兼容，不推荐）
  const queryToken = req.query?.['token'] as string | undefined;
  if (queryToken) {
    return queryToken;
  }

  return null;
}

/**
 * 验证 JWT token 并附加用户到 request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * 要求管理员权限
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * 可选认证 - 有 token 则附加用户，无 token 继续
 * 支持：Authorization Header、Cookie、Query Param
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
  } catch (err) {
    // Token 无效但继续，不阻断请求
  }
  next();
}
