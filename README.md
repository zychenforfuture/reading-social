# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台原型。核心理念是让评论跟着内容走，而不是跟着文档 URL 走。

## 项目摘要

- Web 端已可用：登录注册、阅读、评论回复点赞、目录、阅读设置、通知中心
- API 与 Worker 已可用：鉴权、队列、SSE、SimHash + Embedding、Qdrant 存储
- Mobile 端基础可用：登录注册、阅读评论、个人资料；通知中心与阅读设置待补齐

## 文档分层

- 对外展示版（当前文档）：[README.md](./README.md)
- 内部开发版（详细架构/命令/排障）：[docs/README.dev.md](./docs/README.dev.md)

## 当前能力边界

| 模块 | 状态 | 说明 |
|------|------|------|
| Web | ✅ 已完成 | 含 /profile/messages 通知页面 |
| API | ✅ 已完成 | JWT、OTP、评论、通知、Swagger |
| Worker | ✅ 已完成 | 分块、相似检测、向量写入 |
| Mobile | ⚠️ 部分完成 | 主流程可用，通知与阅读设置未补齐 |
| 跨文档评论产品化 | ⚠️ 部分完成 | 后端支持重映射，前端聚合视图未完成 |

## 3 分钟启动

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker 与 Docker Compose

### 本地开发（推荐）

```bash
pnpm install
pnpm run dev:all
```

### 运行测试

```bash
pnpm test
```

### 生产部署

```bash
cp .env.production.example .env.production
./deploy.sh up
```

## 常用入口

- Web: /login, /register, /, /documents/:id, /profile, /profile/messages
- API 文档: http://localhost:3000/api-docs

## 详细文档

- [docs/README.dev.md](./docs/README.dev.md)：内部开发总览（架构、模块边界、完整命令）
- [LOCAL_DEV.md](./LOCAL_DEV.md)：本地开发与排查
- [LOCAL_TESTING.md](./LOCAL_TESTING.md)：本地测试流程
- [TESTING.md](./TESTING.md)：测试范围与扩展建议
- [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md)：通知系统接口与实现
- [SECURITY_MIGRATION.md](./SECURITY_MIGRATION.md)：安全与鉴权迁移

## 路线图（简版）

1. PDF/EPUB 后端解析链路
2. 生产 HTTPS 自动化
3. Mobile 通知中心与阅读设置
4. 跨文档评论聚合视图

## 许可证

MIT
