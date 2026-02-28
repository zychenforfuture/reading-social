# 跨文档协同评论系统

> 评论跟着内容走，而不是跟着文档走

## 项目简介

这是一个基于内容指纹的跨文档协同评论系统。当同一段内容出现在不同文档中时，针对该内容的评论能自动同步显示。

## 核心特性

- **内容指纹**: 基于 SHA-256 哈希的内容识别
- **跨文档同步**: 评论自动同步到所有包含相同内容的文档
- **大文件优化**: 支持 10MB+ 文件的流式处理
- **模糊匹配**: SimHash + 向量嵌入的语义匹配
- **实时协作**: Yjs + WebSocket 的多人协作编辑

## 技术栈

### 前端
- React 18 + TypeScript + Vite
- Tiptap (富文本编辑器)
- Zustand + TanStack Query
- Yjs (实时协作)
- Tailwind CSS + shadcn/ui

### 后端
- Node.js + TypeScript + Express
- PostgreSQL (元数据)
- Redis (缓存/队列)
- Qdrant (向量索引)
- BullMQ (任务队列)

## 项目结构

```
cross-doc-comments/
├── packages/
│   ├── api/       # API 服务 (Express)
│   ├── web/       # 前端应用 (React + Vite)
│   └── worker/    # 后台 Worker (BullMQ)
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose

### 安装

```bash
# 安装依赖
pnpm install

# 启动基础设施 (PostgreSQL, Redis, Qdrant)
pnpm docker:up

# 运行数据库迁移
pnpm db:migrate

# 启动所有服务
pnpm dev
```

### 访问

- 前端：http://localhost:5173
- API: http://localhost:3000
- API Swagger: http://localhost:3000/docs

## 开发指南

### 单独启动服务

```bash
# 仅启动 API
pnpm dev:api

# 仅启动前端
pnpm dev:web

# 仅启动 Worker
pnpm dev:worker
```

### 构建

```bash
# 构建所有
pnpm build

# 构建单个服务
pnpm build:api
pnpm build:web
```

## 许可证

MIT
