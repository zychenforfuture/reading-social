# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台。上传文章、为任意段落发表评论、与他人互动点赞回复——当同一段文字出现在多篇文档中时，所有读者的批注都会自动汇聚在一起。

## 核心特色

### 内容指纹批注

评论不绑定文档 URL，而是绑定段落内容本身的 SHA-256 哈希。同一段话无论出现在哪篇文档里，所有读者写下的批注都会自动聚合。批量转载、多版本文档不再导致评论分散。

### 内嵌侧边栏评论（仿阅文风格）

阅读页采用正文 + 评论面板并排布局，最大宽度 740 px 居中排版，打开评论时整体扩展至 1080 px，评论栏吸附在文字右侧随章节滚动，不遮挡任何正文内容。

### 个性化阅读设置

内置阅读样式控制面板，支持字号（15–20 px）、行距（1.6–2.2）以及四种背景主题（纯白 / 羊皮纸 / 护眼绿 / 深色），设置持久化到 `localStorage`，刷新后恢复。

### 语义相似推荐

后台对每个段落生成向量嵌入，存入 Qdrant。打开任意段落的评论栏时，系统自动找出语义最相近的其他段落并展示其批注，帮助读者发现相关讨论。

### 大文档无感加载

超大文档通过前端 Web Worker 预处理 + BullMQ 异步队列入库，SSE 实时推送进度；阅读时采用 JOIN 分页查询 + TanStack Virtual 虚拟滚动，10 万段落级文档首屏秒开。

---

## 功能清单

| 功能 | 说明 |
|------|------|
| **内容指纹批注** | SHA-256 段落哈希，评论跨文档自动聚合 |
| **跨文档同步** | 同一段文字在不同文档中的批注统一展示 |
| **评论 · 回复 · 点赞** | 多层嵌套，支持引用原文段落，点赞乐观更新 |
| **内嵌评论侧栏** | sticky 布局，正文与评论并排，不遮挡阅读 |
| **章节评论汇总** | 文档底部按章节汇总全部批注，可独立浏览 |
| **语义相似推荐** | Qdrant 向量检索，推荐语义相近段落的批注 |
| **阅读设置面板** | 字号 / 行距 / 背景主题，localStorage 持久化 |
| **大文件异步处理** | Web Worker + BullMQ + SSE 进度推送 |
| **大文档分页加载** | JOIN 分页 + 虚拟滚动，首屏秒开 |
| **阅读记忆** | 自动记录最后阅读章节，重开后恢复位置 |
| **仿书排版** | 首行缩进、章节标题居中加粗、前言自动识别 |
| **目录章节导航** | 移动端支持 TOC 弹窗，点击章节跳转滚动 |
| **邮箱 OTP** | 注册与重置密码均通过 6 位验证码，无需点击链接 |
| **管理员权限** | 管理员可上传文档、查看上传者信息、删除任意评论 |
| **个人资料** | DiceBear 预设头像或本地图片上传（base64），在线改密码 |

## 技术栈

### 前端（`packages/web`）
- **React 19** + TypeScript + Vite
- **React Router v7** — 客户端路由
- **TanStack Query v5** — 服务端状态与乐观更新
- **TanStack Virtual** — 长列表虚拟滚动
- **TipTap** — 富文本评论编辑器（Highlight、Placeholder 扩展）
- **Yjs + y-websocket** — 协同实时同步基础设施
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
- **SSE**（Server-Sent Events）— 文件处理进度实时推送

### Worker（`packages/worker`）
- BullMQ Worker，负责文档解析、段落切割、向量入库

### 移动端（`packages/mobile`）
- **Expo**（React Native）— 移动端应用（开发中）

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
│   └── mobile/     # Expo 移动端（开发中）
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

- Docker & Docker Compose

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

| 路径 | 说明 |
|------|------|
| `/login` | 登录 |
| `/register` | 注册（邮箱 OTP 验证） |
| `/forgot-password` | 重置密码（邮箱 OTP 验证） |
| `/` | 文档列表首页 |
| `/documents/:id` | 文档阅读 & 批注页 |
| `/profile` | 个人资料（头像设置、修改密码） |

## 许可证

MIT
