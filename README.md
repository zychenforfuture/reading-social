# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台原型。核心理念是让评论跟着内容走，而不是跟着文档 URL 走。

## 项目摘要

- **Web 端** 已可用：登录注册、阅读、评论回复点赞、目录、阅读设置、通知中心、管理员面板
- **API** 已可用：JWT/OAuth、评论、通知、Swagger 文档、管理员 API
- **Worker** 部分完成：分块、SimHash 相似检测、Embedding 向量计算
- **Mobile 端** 基础可用：登录注册、阅读评论、个人资料；通知中心与阅读设置待补齐
- **Admin 面板** 完整实现：系统概览、用户管理、文档管理、评论管理
- **运行策略**：开发采用混合模式，部署采用全 Docker 模式

## 文档分层

| 文档 | 用途 | 链接 |
|------|------|------|
| 对外展示 | 项目介绍与快速开始 | [README.md](./README.md) |
| 内部总览 | 项目全信息 | [docs/README.dev.md](./docs/README.dev.md) |
| 管理员指南 | 管理面板使用说明 | [docs/ADMIN.md](./docs/ADMIN.md) |
| 开发文档 | 本地开发指南 | [docs/development.md](./docs/development.md) |
| 测试文档 | 测试执行说明 | [docs/testing.md](./docs/testing.md) |
| 部署文档 | 生产部署指南 | [docs/deployment.md](./docs/deployment.md) |
| 脚本说明 | 自动化脚本使用 | [scripts/README.md](./scripts/README.md) |

## 当前能力边界

| 模块 | 状态 | 说明 |
|------|------|------|
| Web | ✅ 已完成 | 登录注册、阅读、评论回复点赞、目录、阅读设置、通知中心、管理员面板 |
| API | ✅ 已完成 | JWT/OAuth、评论、通知、Swagger、管理员 API |
| Worker | ⚠️ 部分完成 | 分块、SimHash 已完成；Embedding 后端链路已完成，Qdrant 未集成 |
| Mobile | ⚠️ 部分完成 | 主流程可用，通知中心与阅读设置未补齐 |
| Admin 面板 | ✅ 已完成 | 系统概览、用户/文档/评论管理 |
| 跨文档评论产品化 | ⚠️ 部分完成 | 后端支持重映射，前端聚合视图未完成 |

## 项目结构

```text
reading/
├── packages/
│   ├── api/          # Express.js API 服务（鉴权、评论、通知、管理员 API）
│   ├── web/          # React + Vite Web 前端
│   ├── worker/       # 后台 Worker（分块、Embedding、相似检测）
│   └── mobile/       # Expo React Native 移动端
├── docker/           # Docker 配置文件
├── scripts/          # 自动化脚本（dev.sh、test.sh、deploy.sh）
├── docs/             # 项目文档
├── docker-compose.yml        # 开发环境编排
├── docker-compose.test.yml   # 测试环境编排
└── docker-compose.prod.yml   # 生产环境编排
```

## 技术栈

| 模块 | 技术栈 |
|------|--------|
| **API** | Express.js + PostgreSQL + Redis + BullMQ + JWT |
| **Web** | React 19 + TypeScript + Vite + Tailwind CSS + Radix UI + TanStack Query |
| **Worker** | BullMQ + Transformers.js (all-MiniLM-L6-v2) + SimHash |
| **Mobile** | Expo + React Native + Zustand + TanStack Query |
| **基础设施** | PostgreSQL + Redis + Qdrant (向量数据库) |

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

### Web 端
- 登录：`/login`
- 注册：`/register`
- 首页：`/`
- 文档阅读：`/documents/:id`
- 个人中心：`/profile`
- 消息通知：`/profile/messages`
- 管理员面板：`/admin` （需要管理员权限）

### API
- API 文档：http://localhost:3000/api-docs
- 健康检查：http://localhost:3000/health

### 管理员面板
1. 在数据库中设置管理员：`UPDATE users SET is_admin = true WHERE email = 'your@email.com';`
2. 以管理员账号登录
3. 访问 `/admin` 或点击导航栏"管理面板"链接

## 核心功能

### 评论系统
- 支持评论、回复、点赞
- 评论绑定内容块（sentence_hash），而非文档 URL
- SSE 实时更新
- 跨文档评论重映射支持

### 相似检测
- SimHash：64 位指纹，海明距离阈值 <= 3
- Embedding：all-MiniLM-L6-v2，384 维向量
- 混合策略：Embedding 仅补充 SimHash 未覆盖结果

### 通知系统
- 支持评论回复、点赞通知
- 数据库持久化 + 实时推送
- BullMQ 队列异步处理

### 管理员面板
- 系统概览（Dashboard）：实时统计数据
- 用户管理：权限管理、删除用户
- 文档管理：状态筛选、删除文档
- 评论管理：上下文查看、软删除

## 详细文档

- [docs/README.dev.md](./docs/README.dev.md)：内部开发总览（项目全信息）
- [docs/ADMIN.md](./docs/ADMIN.md)：管理员面板使用指南
- [docs/development.md](./docs/development.md)：开发文档（启动、联调、排障）
- [docs/testing.md](./docs/testing.md)：测试文档（一键测试、覆盖率、故障排查）
- [docs/deployment.md](./docs/deployment.md)：部署文档（生产发布、运维命令、备份）
- [scripts/README.md](./scripts/README.md)：脚本使用说明

## 路线图

### 已完成
- [x] Web 端基础功能（登录、阅读、评论）
- [x] API 服务（鉴权、评论、通知）
- [x] 管理员面板
- [x] SimHash 相似检测
- [x] SSE 评论实时同步

### 进行中
- [ ] PDF/EPUB 后端解析链路
- [ ] Qdrant 向量集成
- [ ] 跨文档评论前端聚合视图

### 规划中
- [ ] 生产 HTTPS 自动化
- [ ] Mobile 通知中心与阅读设置
- [ ] 系统日志查看（操作审计）
- [ ] 批量操作支持

## 常见问题

### JWT_SECRET 配置
启动时会验证 JWT_SECRET 复杂度：
- 长度至少 32 字符
- 熵值至少 3.5 比特/字符
- 不能包含弱模式（password、123456 等）

生成安全的 JWT_SECRET：
```bash
openssl rand -hex 32
```

### 首次启动
首次运行时系统会自动：
1. 启动 Docker 容器（PostgreSQL、Redis、Qdrant）
2. 初始化数据库表和索引
3. 创建 Qdrant 向量集合（约 30-60 秒）
4. 验证环境变量

### 管理员创建
```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

## 许可证

MIT
