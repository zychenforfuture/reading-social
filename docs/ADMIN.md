# 管理员前端使用指南

## 概述

本项目现已实现完整的管理员前端面板，参考 [Xboard](https://github.com/zychenforfuture/Xboard) 项目的管理功能设计。管理员可以管理用户、文档、评论，并查看系统统计信息。

## 功能特性

### 1. 系统概览（Dashboard）
- 实时统计数据展示
  - 用户总数、管理员数量、最近7天新增用户
  - 文档总数、就绪/处理中/错误状态分布、总字数
  - 评论总数、最近7天新增评论
  - 内容块总数
- 文档状态分布图表
- 活跃度统计

### 2. 用户管理
- 查看所有用户列表（分页）
- 搜索用户（邮箱、用户名）
- 查看用户统计（文档数、评论数、注册时间）
- 权限管理
  - 授予/取消管理员权限
  - 防止自我降权保护
- 删除用户（级联删除相关数据）
  - 防止自我删除保护

### 3. 文档管理
- 查看所有文档列表（分页）
- 按状态筛选（全部/就绪/处理中/错误）
- 搜索文档（标题、上传者）
- 查看文档详情
  - 上传者信息
  - 字数统计
  - 评论数量
  - 处理状态
- 删除不当内容

### 4. 评论管理
- 查看所有评论列表（分页）
- 搜索评论（内容、用户名）
- 查看评论上下文
  - 引用的原文
  - 所属内容块
  - 点赞数和回复数
- 删除违规评论（软删除）

## 访问方式

### 1. 设置管理员权限

在数据库中将用户的 `is_admin` 字段设置为 `true`：

```sql
UPDATE users SET is_admin = true WHERE email = 'admin@example.com';
```

### 2. 访问管理面板

1. 以管理员账号登录系统
2. 在顶部导航栏会出现"管理面板"链接（带盾牌图标）
3. 点击进入管理面板，URL: `/admin`

### 3. 路由结构

```
/admin                  - 系统概览
/admin/users           - 用户管理
/admin/documents       - 文档管理
/admin/comments        - 评论管理
```

## API 端点

所有管理员 API 都需要 JWT 认证和管理员权限。

### 统计数据
- `GET /api/admin/stats` - 获取系统统计信息

### 用户管理
- `GET /api/admin/users?page=1&limit=20&search=keyword` - 获取用户列表
- `PUT /api/admin/users/:id` - 更新用户（修改管理员权限）
- `DELETE /api/admin/users/:id` - 删除用户

### 文档管理
- `GET /api/admin/documents?page=1&limit=20&status=ready&search=keyword` - 获取文档列表
- `DELETE /api/admin/documents/:id` - 删除文档

### 评论管理
- `GET /api/admin/comments?page=1&limit=20&search=keyword` - 获取评论列表
- `DELETE /api/admin/comments/:id` - 删除评论（软删除）

## 权限控制

### 后端
- 使用 `authenticate` 中间件验证 JWT token
- 使用 `requireAdmin` 中间件检查 `isAdmin` 标志
- 防止自我操作（删除自己、取消自己管理员权限）

### 前端
- AdminLayout 组件检查用户权限
- 非管理员自动重定向到首页
- 主导航仅向管理员显示"管理面板"链接

## 设计特点

### UI/UX
- 响应式设计，支持桌面和移动端
- 与主应用保持一致的设计风格（Tailwind CSS + 青色主题）
- 清晰的侧边栏导航
- 实时数据加载状态提示
- 友好的确认对话框

### 性能
- 分页加载，每页默认 20 条记录
- 支持搜索和筛选
- 使用 TanStack Query 进行数据缓存和状态管理
- 乐观更新和自动刷新

### 安全性
- 双重权限验证（前端 + 后端）
- 防止 CSRF 攻击（JWT token 验证）
- 敏感操作需要确认
- 防止意外的自我删除/降权

## 开发说明

### 技术栈
- **后端**: Express.js + PostgreSQL
- **前端**: React + TypeScript + Vite
- **状态管理**: Zustand (认证) + TanStack Query (数据)
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **路由**: React Router v7

### 文件结构

```
packages/
├── api/
│   └── src/
│       ├── routes/
│       │   └── admin.ts              # 管理员 API 路由
│       └── middleware/
│           └── auth.ts                # 认证中间件（包含 requireAdmin）
└── web/
    └── src/
        ├── components/
        │   └── admin/
        │       └── AdminLayout.tsx    # 管理员布局组件
        ├── pages/
        │   └── admin/
        │       ├── AdminDashboard.tsx # 概览页面
        │       ├── AdminUsers.tsx     # 用户管理页面
        │       ├── AdminDocuments.tsx # 文档管理页面
        │       └── AdminComments.tsx  # 评论管理页面
        └── lib/
            └── utils.ts               # API 工具函数（包含管理员 API）
```

### 添加新功能

1. **后端**：在 `packages/api/src/routes/admin.ts` 添加新路由
2. **前端 API**：在 `packages/web/src/lib/utils.ts` 添加 API 函数
3. **前端页面**：在 `packages/web/src/pages/admin/` 创建新页面
4. **路由配置**：在 `packages/web/src/App.tsx` 添加路由
5. **导航菜单**：在 `packages/web/src/components/admin/AdminLayout.tsx` 添加导航项

## 测试

### 本地开发测试

1. 启动开发环境：
```bash
pnpm run dev:all
```

2. 创建管理员账号：
```sql
-- 连接到 PostgreSQL
psql -h localhost -U postgres -d collab

-- 设置管理员权限
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

3. 访问 http://localhost:5173/admin

### 生产环境部署

确保在生产环境的数据库中正确设置管理员权限：

```bash
# 使用 docker-compose 进入数据库
docker-compose exec postgres psql -U postgres -d collab

# 设置管理员
UPDATE users SET is_admin = true WHERE email = 'admin@yourdomain.com';
```

## 注意事项

1. **首个管理员创建**：需要手动在数据库中设置第一个管理员
2. **权限传播**：管理员权限通过 JWT token 传递，修改后需要重新登录
3. **删除操作**：用户和文档删除会级联删除相关数据（评论等）
4. **软删除**：评论删除是软删除（标记 `is_deleted = true`）
5. **分页限制**：单页最多显示 100 条记录
6. **搜索性能**：大量数据时建议使用精确搜索而非模糊搜索

## 未来扩展

可以考虑添加的功能：
- 系统日志查看（操作审计）
- 批量操作（批量删除、批量设置权限）
- 数据导出（用户列表、文档列表、评论列表）
- 实时监控（在线用户、系统资源）
- 敏感内容过滤规则配置
- 邮件通知功能
- 备份和恢复功能
