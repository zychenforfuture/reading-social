-- 跨文档协同评论系统数据库初始化脚本

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 使用 gen_random_uuid() 需要 pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pgvector 扩展（可选，如果镜像支持）
CREATE EXTENSION IF NOT EXISTS vector;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(64),
    verification_token_expires TIMESTAMPTZ,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 文档表
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,                   -- 原始文本，用于重新分块（处理完成后置 NULL）
    file_hash VARCHAR(64),          -- 整文件 MD5 (秒传用)
    canonical_document_id UUID REFERENCES documents(id) ON DELETE CASCADE, -- 跨用户去重引用
    doc_simhash VARCHAR(16),        -- 全文 SimHash（文档级近似去重用）
    doc_b0 VARCHAR(4),              -- doc_simhash LSH band 0 (bits 0-15)
    doc_b1 VARCHAR(4),              -- doc_simhash LSH band 1 (bits 16-31)
    doc_b2 VARCHAR(4),              -- doc_simhash LSH band 2 (bits 32-47)
    doc_b3 VARCHAR(4),              -- doc_simhash LSH band 3 (bits 48-63)
    word_count INTEGER DEFAULT 0,
    block_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing',  -- processing, ready, error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_canonical ON documents(canonical_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_b0 ON documents(doc_b0) WHERE doc_b0 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b1 ON documents(doc_b1) WHERE doc_b1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b2 ON documents(doc_b2) WHERE doc_b2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_doc_b3 ON documents(doc_b3) WHERE doc_b3 IS NOT NULL;

-- 内容块表 (核心表)
CREATE TABLE IF NOT EXISTS content_blocks (
    block_hash VARCHAR(64) PRIMARY KEY,
    raw_content TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    occurrence_count INTEGER DEFAULT 1,  -- 在多少文档中出现
    similarity_hash VARCHAR(64),  -- SimHash 用于模糊匹配
    sh_b0 VARCHAR(4),  -- SimHash LSH band 0 (bits 0-15)
    sh_b1 VARCHAR(4),  -- SimHash LSH band 1 (bits 16-31)
    sh_b2 VARCHAR(4),  -- SimHash LSH band 2 (bits 32-47)
    sh_b3 VARCHAR(4),  -- SimHash LSH band 3 (bits 48-63)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_blocks_similarity ON content_blocks(similarity_hash);
CREATE INDEX IF NOT EXISTS idx_cb_sh_b0 ON content_blocks(sh_b0) WHERE sh_b0 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b1 ON content_blocks(sh_b1) WHERE sh_b1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b2 ON content_blocks(sh_b2) WHERE sh_b2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_sh_b3 ON content_blocks(sh_b3) WHERE sh_b3 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_blocks_occurrence ON content_blocks(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_content_blocks_created ON content_blocks(created_at DESC);

-- 文档 - 块映射表 (倒排索引)
CREATE TABLE IF NOT EXISTS document_blocks (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,  -- 在文档中的位置
    start_offset INTEGER,  -- 在原文档中的起始位置
    end_offset INTEGER,  -- 在原文档中的结束位置
    PRIMARY KEY (document_id, block_hash)
);
CREATE INDEX IF NOT EXISTS idx_document_blocks_lookup ON document_blocks(document_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_block_hash_lookup ON document_blocks(block_hash);
CREATE INDEX IF NOT EXISTS idx_document_blocks_block_hash ON document_blocks(block_hash);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- 支持回复
    root_id UUID REFERENCES comments(id) ON DELETE CASCADE,            -- 二级回复根评论
    reply_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    selected_text VARCHAR(500),        -- 用户选中的原文片段
    sentence_hash VARCHAR(64),         -- MD5(selected_text) 用于跨文档评论共享
    like_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    is_resolved BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_by_hash ON comments(block_hash);
CREATE INDEX IF NOT EXISTS idx_comments_by_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_root_id ON comments(root_id);
CREATE INDEX IF NOT EXISTS idx_comments_sentence_hash ON comments(sentence_hash);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_like_count ON comments(like_count DESC);

-- 相似块表 (模糊匹配)
CREATE TABLE IF NOT EXISTS similar_blocks (
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    similar_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    algorithm VARCHAR(20) NOT NULL,  -- 'simhash' | 'embedding'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (block_hash, similar_hash, algorithm)
);
CREATE INDEX IF NOT EXISTS idx_similar_blocks_lookup ON similar_blocks(block_hash, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_similar_blocks_score ON similar_blocks(similarity_score DESC);

-- 文档向量嵌入表 (用于语义搜索)
CREATE TABLE IF NOT EXISTS document_embeddings (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    embedding VECTOR(768),  -- 或 1536 (根据使用的模型)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 失败的向量嵌入记录表 (用于重试)
CREATE TABLE IF NOT EXISTS failed_embeddings (
    block_hash VARCHAR(64) PRIMARY KEY REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_failed_embeddings_retry ON failed_embeddings(created_at);

-- 邮件 OTP 表 (用于注册/登录验证)
CREATE TABLE IF NOT EXISTS email_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose ON email_otps(email, purpose);

-- 通知表
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

-- 点赞计数表 (用于并发点赞控制)
CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

-- 更新时间的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新 updated_at 的表添加触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_blocks_updated_at ON content_blocks;
CREATE TRIGGER update_content_blocks_updated_at BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建块出现次数更新函数
CREATE OR REPLACE FUNCTION update_occurrence_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE content_blocks SET occurrence_count = occurrence_count + 1 WHERE block_hash = NEW.block_hash;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE content_blocks SET occurrence_count = occurrence_count - 1 WHERE block_hash = OLD.block_hash;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_occurrence_count ON document_blocks;
CREATE TRIGGER trigger_update_occurrence_count
    AFTER INSERT OR DELETE ON document_blocks
    FOR EACH ROW EXECUTE FUNCTION update_occurrence_count();

-- 插入初始测试数据
INSERT INTO users (email, username, password_hash) VALUES
    ('admin@example.com', 'Admin', '$2b$10$dummy_hash_for_demo_purpose_only'),
    ('user@example.com', 'User', '$2b$10$dummy_hash_for_demo_purpose_only');

-- 打印完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '表：users, documents, content_blocks, document_blocks, comments, similar_blocks, document_embeddings, failed_embeddings, email_otps, notifications, comment_likes';
    RAISE NOTICE '测试用户：admin@example.com / user@example.com';
END $$;
