-- 用户通知表迁移脚本
-- 运行方式：docker exec -i reading-postgres-1 psql -U postgres -d collab < scripts/migrate-notifications.sql

-- 启用 UUID 扩展（如果还没有）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户通知表
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- reply, mention, system, like
    title VARCHAR(200) NOT NULL,
    content TEXT,
    data JSONB DEFAULT '{}',  -- 额外数据 {commentId, documentId, etc.}
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);

-- 打印完成信息
DO $$
BEGIN
    RAISE NOTICE '通知表迁移完成！';
    RAISE NOTICE '表：notifications';
END $$;
