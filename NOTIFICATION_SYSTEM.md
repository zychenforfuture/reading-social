# 通知系统

## 状态

- API：✅ 已实现
- Web：✅ 已实现（通知铃铛 + 通知页面）
- Mobile：⏳ 未实现通知页面

## 功能范围

当前通知类型：
- reply：回复通知
- mention：提及通知
- like：点赞通知

## 后端实现

主要文件：
- packages/api/src/routes/notification.ts
- packages/api/src/utils/notifications.ts
- packages/api/src/routes/comment.ts

主要端点：
- GET /api/notifications
- GET /api/notifications/unread-count
- PUT /api/notifications/read-all
- PUT /api/notifications/read-batch
- PUT /api/notifications/:id/read
- DELETE /api/notifications/:id
- POST /api/notifications/delete-batch

数据库表（启动时自动迁移创建）：

```sql
notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,        -- reply | mention | like
  title VARCHAR(200) NOT NULL,
  content TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL
)
```

## Web 实现

主要文件：
- packages/web/src/components/NotificationBell.tsx
- packages/web/src/pages/ProfileMessages.tsx
- packages/web/src/hooks/useNotifications.ts

已实现能力：
- 顶栏未读角标
- 通知列表分页与筛选
- 单条已读 / 批量已读
- 单条删除 / 批量删除

## 部署与迁移

通知表由 API 启动时自动创建，一般不需要手工执行迁移脚本。

部署后验证：
1. 登录 Web。
2. 右上角查看通知铃铛未读数。
3. 打开 /profile/messages 验证读写与删除行为。

## 已知边界

- 当前没有 WebSocket 推送，通知主要通过轮询/刷新机制更新。
- Mobile 端暂未提供通知页面。

更新时间：2026-03-14
