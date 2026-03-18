# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台原型。核心理念是让评论跟着内容走，而不是跟着文档 URL 走。

## 项目摘要

- Web 端已可用：登录注册、阅读、评论回复点赞、目录、阅读设置、通知中心
- API 已可用：鉴权、队列、SSE、SimHash；Embedding 后端链路已完成，Qdrant 未集成
- Mobile 端基础可用：登录注册、阅读评论、个人资料；通知中心与阅读设置待补齐
- 运行策略：开发采用混合模式，部署采用全 Docker 模式

## 文档分层

- 对外展示版（当前文档）：[README.md](./README.md)
- 维护总览（项目全信息）：[docs/README.dev.md](./docs/README.dev.md)
- 维护文档（开发/测试/部署）：见 docs 目录下三份文档

## 当前能力边界

| 模块 | 状态 | 说明 |
|------|------|------|
| Web | ✅ 已完成 | 含 /profile/messages 通知页面 |
| API | ✅ 已完成 | JWT、OTP、评论、通知、Swagger |
| Worker | ⚠️ 部分完成 | 分块、SimHash 已完成；Embedding 后端链路已完成，Qdrant 未集成 |
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
./scripts/dev.sh up   # 混合模式启动（推荐）
# 或 pnpm run dev:all  # 直接使用 workspace 脚本
```

### 运行测试

```bash
pnpm test
```

### 生产部署

```bash
cp .env.production.example .env.production
./scripts/deploy.sh up
```

## 常用入口

- Web: /login, /register, /, /documents/:id, /profile, /profile/messages
- API 文档: http://localhost:3000/api-docs

## 详细文档

- [docs/README.dev.md](./docs/README.dev.md)：内部开发总览（项目全信息）
- [docs/development.md](./docs/development.md)：开发文档（启动、联调、排障）
- [docs/testing.md](./docs/testing.md)：测试文档（一键测试、覆盖率、故障排查）
- [docs/deployment.md](./docs/deployment.md)：部署文档（生产发布、运维命令、备份）

## 路线图（简版）

1. PDF/EPUB 后端解析链路
2. 生产 HTTPS 自动化
3. Mobile 通知中心与阅读设置
4. 跨文档评论聚合视图

## 许可证

MIT
