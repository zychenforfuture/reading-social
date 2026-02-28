import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { logger } from './config/logger.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/document.js';
import { commentRoutes } from './routes/comment.js';
import { blockRoutes } from './routes/block.js';

const app: Express = express();

// 信任 nginx 反向代理，正确识别真实客户端 IP
app.set('trust proxy', 1);

// 安全中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// 限流中间件
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 1000, // 每个 IP 最多 1000 个请求（轮询场景下 100 太低）
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// 解析中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());
app.use(cookieParser());

// 健康检查端点
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/blocks', blockRoutes);

// 404 处理
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// 全局错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Global error handler:', err);

  res.status(err instanceof Error && 'status' in err ? (err as any).status : 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
