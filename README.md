# 共鸣阅读

> 评论跟着内容走，而不是跟着文档走

一个面向阅读社群的跨文档协同批注平台。上传文章、为任意段落发表评论、与他人互动点赞回复——当同一段文字出现在多篇文档中时，所有读者的批注都会自动汇聚在一起。

## 功能亮点

| 功能 | 说明 |
|------|------|
| **内容指纹批注** | 基于 SHA-256 对段落内容进行哈希，评论绑定内容而非文档路径 |
| **跨文档同步** | 同一段落在不同文档中的批注自动聚合展示 |
| **评论 · 回复 · 点赞** | 多层嵌套结构，支持 @mention，点赞实时反弹 |
| **章节评论汇总** | 文档底部按章节汇总全部批注，脱离右侧面板也可浏览 |
| **语义相似推荐** | 基于向量嵌入（Qdrant）推荐语义相近的段落及其批注 |
| **大文件处理** | 10 MB+ 文档通过 Web Worker + BullMQ 异步解析，不阻塞主线程 |
| **邮箱 OTP 注册** | 注册和重置密码均通过 6 位验证码完成，无需点击链接 |
| **管理员权限** | 管理员可上传文档、查看上传者信息 |

## 技术栈

### 前端（`packages/web`）
- **React 18** + TypeScript + Vite
- **TanStack Query** — 服务端状态与乐观更新
- **Zustand** — 客户端用户状态持久化
- **Tailwind CSS** — 样式
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

### 基础设施
- **Docker Compose** — 一键本地 / 生产部署
- **Nginx** — 前端静态托管 + API 反代

## 项目结构

```
reading/
├── packages/
│   ├── api/        # Express API 服务
│   ├── web/        # React 前端
│   └── worker/     # BullMQ 后台工作进程
├── docker/
│   ├── nginx/      # Nginx 配置
│   └── postgres/   # 数据库初始化 SQL
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── pnpm-workspace.yaml
```

## 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 9
- Docker & Docker Compose

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动基础设施（PostgreSQL / Redis / Qdrant）
docker compose -f docker-compose.dev.yml up -d

# 启动所有服务（热重载）
pnpm dev
```

访问地址：
- 前端：http://localhost:5173
- API：http://localhost:3000
- API 文档：http://localhost:3000/docs

### 生产部署

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

## License

MIT


## 许可证

MIT
