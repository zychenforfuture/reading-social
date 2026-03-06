# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台。上传文章、为任意段落发表评论、与他人互动点赞回复。当同一段文字出现在多篇文档中时，读者的讨论可以在内容维度聚合，而不是绑定到单一文档 URL。

## 开发进度（2026-03-06 更新）

| 模块 | 进度 | 状态说明 |
|------|------|----------|
| **Web 端**（`packages/web`） | 90% | 登录/注册/找回密码、文档上传与阅读、评论回复点赞、目录与阅读设置已可用 |
| **API**（`packages/api`） | 95% | JWT 鉴权 + bcrypt 密码哈希已完成、OTP、文档处理队列、评论 SSE、跨文档评论聚合已可用；Swagger 文档已配置 |
| **Worker**（`packages/worker`） | 70% | 文档分块、内容哈希入库、去重复用已可用；SimHash 相似块检测已实现；向量写入链路待补全 |
| **Mobile**（`packages/mobile`） | 85% | 登录/注册/阅读/评论/个人中心界面与主流程已可用；API 已与 Web 端和后端完全对齐 |
| **测试覆盖** | 80% | 45 个自动化测试用例，覆盖认证/文档/评论核心功能；本地测试环境一键启动 |
| **Docker 部署** | 95% | 本地与生产 compose 均可启动，支持 Postgres/Redis/Qdrant/API/Worker/Web；环境变量验证已添加 |

## 核心特色

### 内容指纹批注

评论不绑定文档 URL，而是绑定段落内容本身的 SHA-256 哈希。同一段话无论出现在哪篇文档里，所有读者写下的批注都会自动聚合。批量转载、多版本文档不再导致评论分散。

### 内嵌侧边栏评论（仿阅文风格）

阅读页采用正文 + 评论面板并排布局，最大宽度 740 px 居中排版，打开评论时整体扩展至 1080 px，评论栏吸附在文字右侧随章节滚动，不遮挡任何正文内容。

### 个性化阅读设置

内置阅读样式控制面板，支持字号（15–20 px）、行距（1.6–2.2）以及四种背景主题（纯白 / 羊皮纸 / 护眼绿 / 深色），设置持久化到 `localStorage`，刷新后恢复。

### 语义相似推荐（进行中）

已预留 Qdrant 集合和相似块查询接口，前后端都已接入相似内容展示位。当前向量生成与回写链路仍在完善中。

### 大文档无感加载

大文档通过前端 Web Worker 预处理 + BullMQ 异步队列入库；阅读端使用分批拉取与章节定位，评论通过 SSE 实时同步。

---

## 功能清单（按当前实现）

| 功能 | 说明 | 状态 |
|------|------|------|
| **内容指纹批注** | SHA-256 段落哈希，评论跨文档自动聚合 | ✅ 完成 |
| **跨文档同步** | 同一段文字在不同文档中的批注统一展示 | ✅ 完成 |
| **评论 · 回复 · 点赞** | 多层嵌套，支持引用原文段落，点赞乐观更新 | ✅ 完成 |
| **内嵌评论侧栏** | sticky 布局，正文与评论并排，不遮挡阅读 | ✅ 完成 |
| **章节评论汇总** | 文档底部按章节汇总全部批注，可独立浏览 | ✅ 完成 |
| **语义相似推荐（Beta）** | 已有相似块查询接口与 UI，SimHash 已实现 | ⏳ 进行中 |
| **阅读设置面板** | 字号 / 行距 / 背景主题，localStorage 持久化 | ✅ 完成 |
| **大文件异步处理** | Web Worker + BullMQ 队列处理 | ✅ 完成 |
| **大文档分批加载** | JOIN 分页查询 + 渐进渲染 | ✅ 完成 |
| **阅读记忆** | 自动记录最后阅读章节，重开后恢复位置 | ✅ 完成 |
| **仿书排版** | 首行缩进、章节标题居中加粗、前言自动识别 | ✅ 完成 |
| **目录章节导航** | 移动端支持 TOC 弹窗，点击章节跳转滚动 | ✅ 完成 |
| **邮箱 OTP** | 注册与重置密码均通过 6 位验证码，无需点击链接 | ✅ 完成 |
| **管理员权限** | 管理员可上传文档、查看上传者信息、删除任意评论 | ✅ 完成 |
| **个人资料** | 头像更新与修改密码，全平台已对齐 | ✅ 完成 |
| **JWT 鉴权** | 真实 JWT token 签发与校验，7 天有效期 | ✅ 完成 |
| **bcrypt 密码** | 密码安全哈希存储 | ✅ 完成 |
| **自动化测试** | 45 个测试用例，覆盖核心功能 | ✅ 完成 |
| **本地测试** | 一键启动测试环境（Postgres + Redis） | ✅ 完成 |
| **Swagger 文档** | API 文档在线查看（/api-docs） | ✅ 完成 |

## 已知限制

- ✅ **鉴权已完成** - JWT + bcrypt 密码哈希已实现并测试通过
- ⏳ **文档格式** - 目前仅支持 `.txt`，PDF/EPUB 支持开发中
- ⏳ **向量嵌入** - SimHash 已实现，语义向量嵌入链路待补全
- ⏳ **HTTPS** - 生产环境需配置 HTTPS（Let's Encrypt）

## 技术栈

### 前端（`packages/web`）
- **React 19** + TypeScript + Vite
- **React Router v7** — 客户端路由
- **TanStack Query v5** — 服务端状态与乐观更新
- **TipTap** — 富文本评论编辑器（Highlight、Placeholder 扩展）
- **Radix UI** — 无障碍 UI 原语（Dialog、DropdownMenu、Tooltip 等）
- **Zustand** — 客户端用户状态持久化
- **Tailwind CSS v4** — 样式
- **Web Worker** — 大文件客户端预处理

### 后端（`packages/api`）
- **Node.js** + TypeScript + Express
- **PostgreSQL** — 用户、文档、评论元数据
- **Redis** + **BullMQ** — 文件处理任务队列
- **Qdrant** — 段落向量索引与相似搜索
- **Nodemailer** — 阿里云 SMTP 发送 OTP 邮件
- **SSE**（Server-Sent Events）— 评论实时推送

### Worker（`packages/worker`）
- BullMQ Worker，负责文档解析、段落切割、内容哈希入库

### 移动端（`packages/mobile`）
- **Expo**（React Native）— 移动端应用（Beta）

### 基础设施
- **Docker Compose** — 一键本地 / 生产部署
- **Nginx** — 前端静态托管 + API 反代
- **本地 volumes/** — postgres / redis / qdrant 数据持久化到项目目录，便于备份

## 项目结构

```
reading/
├── packages/
│   ├── api/        # Express API 服务
│   ├── web/        # React 19 前端
│   ├── worker/     # BullMQ 后台工作进程
│   └── mobile/     # Expo 移动端（Beta）
├── docker/
│   ├── nginx/      # Nginx 配置
│   └── postgres/   # 数据库初始化 SQL
├── volumes/        # 数据库持久化目录（gitignore）
│   ├── postgres/data/
│   ├── redis/
│   └── qdrant/
├── docker-compose.yml
├── docker-compose.prod.yml
└── pnpm-workspace.yaml
```

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

### 本地开发（推荐）

```bash
# 1) 安装依赖
pnpm install

# 2) 启动基础设施（Postgres / Redis / Qdrant）
docker compose up -d postgres redis qdrant

# 3) 分别启动 API / Worker / Web
pnpm --filter @collab/api dev
pnpm --filter @collab/worker dev
pnpm --filter @collab/web dev
```

移动端（可选）：

```bash
cd packages/mobile
npm install
npm run start
```

### 运行测试

```bash
# 一键运行所有测试（自动启动测试服务）
./scripts/test.sh

# 或从根目录
pnpm test

# 快速测试（无需数据库）
pnpm test:quick

# 监听模式（开发时使用）
pnpm test:watch
```

测试覆盖：
- ✅ 用户认证（登录/注册/密码修改）
- ✅ 文档管理（上传/列表/删除）
- ✅ 评论系统（创建/回复/点赞/删除）
- ✅ 权限验证（JWT/管理员）

### 部署

```bash
# 复制并填写环境变量
cp .env.production.example .env.production

# 一键构建并启动
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

`.env.production` 需配置的关键变量：

```env
DB_PASSWORD=
REDIS_PASSWORD=
JWT_SECRET=
FRONTEND_URL=https://your-domain.com

# 初始管理员账号（首次启动若该邮箱不存在则自动创建，留空跳过）
ADMIN_INIT_EMAIL=admin@example.com
ADMIN_INIT_USERNAME=admin
ADMIN_INIT_PASSWORD=your-password

# 管理员邮箱列表（逗号分隔，用于同步 is_admin 标记）
ADMIN_EMAILS=admin@example.com

# 阿里云 SMTP（邮箱验证码）
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=your@domain.com
SMTP_PASS=
SMTP_FROM=your@domain.com
```

## 页面路由

### Web 端

| 路径 | 说明 |
|------|------|
| `/login` | 登录 |
| `/register` | 注册（邮箱 OTP 验证） |
| `/forgot-password` | 重置密码（邮箱 OTP 验证） |
| `/` | 文档列表首页 |
| `/documents/:id` | 文档阅读 & 批注页 |
| `/profile` | 个人资料（头像设置、修改密码） |

### API 文档

访问 Swagger UI 查看完整 API 文档：

```
http://localhost:3000/api-docs
```

或通过移动端查看：[`packages/mobile/API_FIXES.md`](./packages/mobile/API_FIXES.md)

---

## 相关文档

- [`LOCAL_TESTING.md`](./LOCAL_TESTING.md) - 本地测试完整指南
- [`SECURITY_MIGRATION.md`](./SECURITY_MIGRATION.md) - JWT 鉴权迁移指南
- [`TESTING.md`](./TESTING.md) - 测试编写指南
- [`packages/mobile/API_FIXES.md`](./packages/mobile/API_FIXES.md) - 移动端 API 对齐说明

## 后续里程碑

### ✅ 已完成（2026-03-06）

- ✅ JWT 鉴权与权限中间件替换
- ✅ bcrypt 密码安全哈希与迁移
- ✅ 移动端 API 与 Web 端和后端完全对齐
- ✅ 自动化测试框架与 45 个测试用例
- ✅ 本地测试环境一键启动
- ✅ Swagger API 文档配置
- ✅ 环境变量验证与启动检查

### 📋 待完成

1. **向量嵌入链路** - 打通 Worker → Qdrant → 语义相似推荐闭环
2. **文档格式扩展** - 支持 PDF/EPUB 上传与解析
3. **生产 HTTPS** - 配置 Let's Encrypt 证书
4. **用户通知系统** - 评论回复@通知、点赞通知
5. **搜索功能增强** - 全文搜索、结果排序、搜索历史

## 许可证

MIT
