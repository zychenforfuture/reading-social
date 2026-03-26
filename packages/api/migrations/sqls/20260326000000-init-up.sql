-- 这个迁移假定基础表已经由 docker/postgres/init.sql 创建
-- 为 users 表添加 auth 新增的字段
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

UPDATE users SET email_verified = true
WHERE email_verified IS NULL OR email_verified = false
  AND verification_token IS NULL;

CREATE TABLE IF NOT EXISTS email_otps (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose);

ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;

-- 为 SimHash LSH 加 4 个 band 列（如已存在则跳过）
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS sh_b0 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS sh_b1 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS sh_b2 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS sh_b3 VARCHAR(4);
CREATE INDEX IF NOT EXISTS idx_cb_sh_b0 ON content_blocks(sh_b0) WHERE sh_b0 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b1 ON content_blocks(sh_b1) WHERE sh_b1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b2 ON content_blocks(sh_b2) WHERE sh_b2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b3 ON content_blocks(sh_b3) WHERE sh_b3 IS NOT NULL;

-- 失败嵌入记录表（用于重试，worker 依赖此表）
CREATE TABLE IF NOT EXISTS failed_embeddings (
  block_hash VARCHAR(64) PRIMARY KEY REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_failed_embeddings_retry ON failed_embeddings(created_at);

-- 文档级 SimHash（优化三：文档近似去重，跨用户同书识别）
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_simhash VARCHAR(16),
  ADD COLUMN IF NOT EXISTS doc_b0 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS doc_b1 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS doc_b2 VARCHAR(4),
  ADD COLUMN IF NOT EXISTS doc_b3 VARCHAR(4);
CREATE INDEX IF NOT EXISTS idx_documents_doc_b0 ON documents(doc_b0) WHERE doc_b0 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b1 ON documents(doc_b1) WHERE doc_b1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b2 ON documents(doc_b2) WHERE doc_b2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b3 ON documents(doc_b3) WHERE doc_b3 IS NOT NULL;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(50)  NOT NULL,          -- reply | mention | like
  title        VARCHAR(200) NOT NULL,
  content      TEXT,
  data         JSONB        NOT NULL DEFAULT '{}',
  is_read      BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id) WHERE is_read = false;
