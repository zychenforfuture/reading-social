# 用户通知系统

> 实现时间：2026-03-07

## 📖 功能概述

共鸣阅读平台的通知系统，支持以下通知类型：

- **💬 回复通知** - 有人回复了你的评论
- **🔔 提及通知** - 有人在评论中@了你
- **❤️ 点赞通知** - 有人点赞了你的评论（待实现）
- **⚙️ 系统通知** - 系统公告、更新等

## 🛠️ 技术实现

### 后端 (API)

**文件结构**:
```
packages/api/src/
├── config/notificationQueue.ts    # BullMQ 通知队列配置
├── routes/notifications.ts        # 通知 API 路由
└── routes/comment.ts              # 评论路由（已集成通知）
```

**API 端点**:
- `GET /api/notifications` - 获取通知列表
- `GET /api/notifications/unread-count` - 获取未读数量
- `PUT /api/notifications/:id/read` - 标记单个已读
- `PUT /api/notifications/read-all` - 全部标记已读
- `DELETE /api/notifications/:id` - 删除通知
- `POST /api/notifications` - 创建通知（内部使用）

**数据库表**:
```sql
notifications (
  id UUID,
  user_id UUID,
  type VARCHAR(50),      -- reply/mention/system/like
  title VARCHAR(200),
  content TEXT,
  data JSONB,            -- 额外数据
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
)
```

### 前端 (Web)

**文件结构**:
```
packages/web/src/
├── hooks/useNotifications.ts      # 通知 Hook
├── components/NotificationBell.tsx # 通知铃铛组件
└── components/Layout.tsx          # 已集成铃铛
```

**功能**:
- 📱 响应式设计（移动端适配）
- 🔴 未读角标显示
- ⚡ 实时刷新
- 🗑️ 删除通知
- ✅ 标记已读/全部已读

## 🚀 部署步骤

### 1. 数据库迁移

**生产环境**:
```bash
docker exec -i reading-postgres-1 psql -U postgres -d collab < scripts/migrate-notifications.sql
```

**测试环境**:
```bash
docker exec -i reading-test-postgres-1 psql -U postgres -d collab_test < scripts/migrate-notifications.sql
```

### 2. 重启 API 服务

```bash
# 生产环境
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build api

# 测试环境
docker compose -f docker-compose.test.yml up -d --build api
```

### 3. 验证

访问 Web 端，登录后应该能看到：
- Header 右上角的通知铃铛图标
- 未读通知时显示红色角标
- 点击铃铛查看通知列表

## 📝 使用示例

### 创建通知（后端）

```typescript
import { notificationQueue } from '../config/notificationQueue.js';

// 创建回复通知
await notificationQueue.add('send-notification', {
  userId: 'user-uuid',
  type: 'reply',
  title: '有人回复了你的评论',
  content: '回复内容...',
  data: { commentId: 'xxx', rootId: 'xxx' },
  sendTelegram: false, // 可选：是否发送 Telegram 推送
});
```

### 获取通知（前端）

```typescript
import { useNotifications } from './hooks/useNotifications';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <div>
      {unreadCount > 0 && <span>{unreadCount} 未读</span>}
      {notifications.map(n => (
        <div key={n.id}>{n.title}</div>
      ))}
    </div>
  );
}
```

## 🔮 待扩展功能

- [ ] Telegram 推送集成
- [ ] 邮件通知
- [ ] WebSocket 实时推送
- [ ] 通知设置（用户可选择接收哪些类型）
- [ ] 点赞通知
- [ ] 评论被删除时的通知处理

## 📊 测试

运行 API 测试：
```bash
cd packages/api
pnpm test
```

测试通知相关功能：
- 创建评论回复 → 检查通知是否创建
- 获取通知列表 → 验证数据格式
- 标记已读 → 验证状态更新

---

**最后更新**: 2026-03-07
**状态**: ✅ 开发完成，待部署测试
