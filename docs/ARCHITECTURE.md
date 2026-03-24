# 共鸣阅读 - 系统架构文档

本文档描述共鸣阅读平台的系统架构、数据流和技术实现细节。

---

## 1. 系统概览

共鸣阅读是一个跨文档协同批注平台，采用微服务架构，包含四个核心服务：

- **API Service**: RESTful API 服务
- **Web Frontend**: 用户界面
- **Worker Service**: 异步任务处理
- **Mobile App**: 移动端应用

## 2. 架构图

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                           客户端层                               │
├─────────────┬─────────────┬─────────────────────────────────────┤
│   Web App   │  Mobile App │           第三方客户端               │
│  (React)    │(React Native│              (未来)                  │
│             │   + Expo)   │                                     │
└──────┬──────┴──────┬──────┴───────────────┬─────────────────────┘
       │             │                      │
       └─────────────┴──────────────────────┘
                       │
                       ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                          API Gateway                             │
│                     (Nginx / Traefik)                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          服务层                                  │
├──────────────────┬──────────────────┬───────────────────────────┤
│   API Service    │  Worker Service  │     Infrastructure        │
│   (Express.js)   │   (BullMQ)       │                           │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • 认证/授权      │ • 文档分块       │ • PostgreSQL              │
│ • 评论管理       │ • SimHash 计算   │ • Redis                   │
│ • 通知推送       │ • Embedding 生成 │ • Qdrant (配置中)         │
│ • 文档管理       │ • 相似度检测     │                           │
└────────┬─────────┴────────┬─────────┴───────────┬───────────────┘
         │                  │                     │
         └──────────────────┴─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          数据层                                  │
├──────────────────┬──────────────────┬───────────────────────────┤
│   PostgreSQL     │      Redis       │        Qdrant             │
│   (主数据库)      │    (缓存/队列)    │    (向量数据库)            │
├──────────────────┼──────────────────┼───────────────────────────┤
│ • 用户数据       │ • Session 缓存   │ • 文档向量 (待集成)        │
│ • 文档元数据     │ • 任务队列       │ • 相似度检索              │
│ • 评论数据       │ • 实时通知       │                           │
│ • 通知数据       │                  │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
```

### 2.2 数据流图

#### 文档上传流程

```
用户上传文档
    │
    ▼
┌─────────────┐
│  API Service │ ◄── 接收上传请求，保存原始文档
└──────┬──────┘
       │
       ▼ 创建处理任务
┌─────────────┐
│  Redis Queue │ ◄── BullMQ 任务队列
└──────┬──────┘
       │
       ▼ 消费任务
┌─────────────┐
│   Worker     │ ◄── 文档处理
│  Service     │     1. 文本分块
└──────┬──────┘     2. SimHash 计算
       │            3. Embedding 生成
       ▼
┌─────────────┐
│  PostgreSQL  │ ◄── 保存分块结果
│  + Qdrant    │     保存哈希/向量
└─────────────┘
```

#### 评论创建流程

```
用户发表评论
    │
    ▼
┌─────────────┐
│  API Service │ ◄── 验证并保存评论
└──────┬──────┘
       │
       ├──────────────┐
       ▼              ▼
┌─────────────┐  ┌─────────────┐
│  PostgreSQL  │  │  Redis Pub   │ ◄── 发布通知事件
│  (保存评论)  │  │  /Sub        │
└─────────────┘  └──────┬──────┘
                        │
                        ▼
               ┌─────────────┐
               │  SSE Stream  │ ◄── 实时推送给在线用户
               │  (Web客户端)  │
               └─────────────┘
```

## 3. 核心模块详解

### 3.1 API Service (packages/api)

**技术栈**: Express.js + TypeScript + PostgreSQL + Prisma

**主要模块**:

```
packages/api/src/
├── routes/
│   ├── auth.ts          # 认证路由 (JWT/OAuth/OTP)
│   ├── document.ts      # 文档管理
│   ├── comment.ts       # 评论系统 (含 SSE)
│   ├── admin.ts         # 管理员 API
│   ├── notification.ts  # 通知管理
│   └── block.ts         # 内容块查询
├── middleware/
│   ├── auth.ts          # JWT 验证 / 管理员权限
│   └── error.ts         # 错误处理
├── services/
│   └── ...              # 业务逻辑
└── utils/
    ├── email.ts         # 邮件发送
    └── simhash.ts       # SimHash 工具
```

**关键设计**:
- **JWT 认证**: 无状态认证，支持 Token 刷新
- **SSE 实时推送**: 评论更新实时通知客户端
- **OTP 邮箱验证**: 注册/找回密码的二次验证
- **管理员权限**: 独立的权限中间件

### 3.2 Web Frontend (packages/web)

**技术栈**: React 19 + Vite + Tailwind CSS + TanStack Query

**主要模块**:

```
packages/web/src/
├── pages/
│   ├── HomePage.tsx           # 文档列表
│   ├── DocumentPage.tsx       # 阅读页面 (核心)
│   ├── LoginPage.tsx          # 登录
│   ├── RegisterPage.tsx       # 注册
│   ├── ProfilePage.tsx        # 个人中心
│   ├── ProfileMessages.tsx    # 通知中心
│   └── admin/                 # 管理员面板
│       ├── AdminDashboard.tsx
│       ├── AdminUsers.tsx
│       ├── AdminDocuments.tsx
│       └── AdminComments.tsx
├── components/
│   ├── CommentPanel.tsx       # 评论侧边栏
│   ├── TableOfContents.tsx    # 目录导航
│   ├── document/
│   │   ├── DocumentContent.tsx
│   │   ├── ReadingSettings.tsx
│   │   └── ChapterComments.tsx
│   └── comment/               # 评论组件
├── hooks/
│   ├── useCommentSSE.ts       # SSE 连接管理
│   └── useNotifications.ts    # 通知状态
└── stores/
    └── userStore.ts           # Zustand 用户状态
```

**关键设计**:
- **虚拟滚动**: 大文档分块加载，流畅阅读体验
- **Optimistic UI**: 评论点赞即时反馈
- **状态管理**: Zustand (客户端) + TanStack Query (服务端)
- **响应式设计**: 移动端适配

### 3.3 Worker Service (packages/worker)

**技术栈**: BullMQ + Transformers.js + SimHash

**主要功能**:

```
packages/worker/src/
├── index.ts           # Worker 入口
├── utils/
│   ├── chunker.ts     # 文本分块
│   ├── simhash.ts     # SimHash 计算
│   └── embedding.ts   # Embedding 生成
└── db/                # 数据库操作
```

**处理流程**:

1. **文档分块**
   - 按段落/句子分割
   - 保留章节结构信息
   - 生成内容块 ID

2. **SimHash 计算**
   - 64 位指纹生成
   - 海明距离相似度检测
   - 阈值: <= 3 视为相似

3. **Embedding 生成**
   - 模型: all-MiniLM-L6-v2
   - 维度: 384 维向量
   - 异步计算，不阻塞文档 ready

### 3.4 Mobile App (packages/mobile)

**技术栈**: Expo + React Native + Zustand

**主要功能**:
- 与 Web 端共享 API
- SecureStore 安全存储 Token
- 基础阅读/评论功能

## 4. 数据库设计

### 4.1 核心表结构

```sql
-- 用户表
users
├── id: UUID PK
├── email: String UNIQUE
├── username: String
├── password_hash: String
├── avatar_url: String?
├── is_admin: Boolean
├── created_at: Timestamp
└── updated_at: Timestamp

-- 文档表
documents
├── id: UUID PK
├── title: String
├── content: Text
├── word_count: Int
├── block_count: Int
├── status: Enum (processing/ready/error)
├── uploader_id: UUID FK
├── created_at: Timestamp
└── updated_at: Timestamp

-- 内容块表
content_blocks
├── id: UUID PK
├── document_id: UUID FK
├── block_hash: String UNIQUE  -- SimHash
├── raw_content: Text
├── sentence_hash: String      -- 用于跨文档关联
├── embedding: Vector(384)?    -- pgvector
├── position: Int
└── created_at: Timestamp

-- 评论表
comments
├── id: UUID PK
├── document_id: UUID FK
├── block_hash: String FK
├── user_id: UUID FK
├── content: Text
├── selected_text: Text?       -- 选中的原文
├── parent_id: UUID? FK        -- 回复层级
├── like_count: Int
├── is_deleted: Boolean
├── created_at: Timestamp
└── updated_at: Timestamp

-- 通知表
notifications
├── id: UUID PK
├── user_id: UUID FK
├── type: Enum (reply/mention/like)
├── title: String
├── content: String?
├── is_read: Boolean
├── data: JSON                 -- 关联数据
├── created_at: Timestamp
└── updated_at: Timestamp
```

### 4.2 索引设计

```sql
-- 性能优化索引
CREATE INDEX idx_comments_block_hash ON comments(block_hash);
CREATE INDEX idx_comments_document_id ON comments(document_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_content_blocks_document ON content