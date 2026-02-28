-- 跨文档协同评论系统数据库初始化脚本

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- 文档表
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64),  -- 整文件 MD5 (秒传用)
    word_count INTEGER DEFAULT 0,
    block_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing',  -- processing, ready, error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_file_hash ON documents(file_hash);
CREATE INDEX idx_documents_status ON documents(status);

-- 内容块表 (核心表)
CREATE TABLE IF NOT EXISTS content_blocks (
    block_hash VARCHAR(64) PRIMARY KEY,
    raw_content TEXT NOT NULL,
    normalized_content TEXT,
    word_count INTEGER DEFAULT 0,
    occurrence_count INTEGER DEFAULT 1,  -- 在多少文档中出现
    similarity_hash VARCHAR(64),  -- SimHash 用于模糊匹配
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_blocks_similarity ON content_blocks(similarity_hash);

-- 文档 - 块映射表 (倒排索引)
CREATE TABLE IF NOT EXISTS document_blocks (
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,  -- 在文档中的位置
    start_offset INTEGER,  -- 在原文档中的起始位置
    end_offset INTEGER,  -- 在原文档中的结束位置
    PRIMARY KEY (document_id, block_hash)
);
CREATE INDEX idx_document_blocks_lookup ON document_blocks(document_id, sequence_order);
CREATE INDEX idx_block_hash_lookup ON document_blocks(block_hash);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- 支持回复
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_by_hash ON comments(block_hash);
CREATE INDEX idx_comments_by_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);

-- 相似块表 (模糊匹配)
CREATE TABLE IF NOT EXISTS similar_blocks (
    block_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    similar_hash VARCHAR(64) REFERENCES content_blocks(block_hash) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    algorithm VARCHAR(20) NOT NULL,  -- 'simhash' | 'embedding'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (block_hash, similar_hash, algorithm)
);
CREATE INDEX idx_similar_blocks_lookup ON similar_blocks(block_hash, similarity_score DESC);

-- 文档向量嵌入表 (用于语义搜索)
CREATE TABLE IF NOT EXISTS document_embeddings (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    embedding VECTOR(768),  -- 或 1536 (根据使用的模型)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新时间的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新 updated_at 的表添加触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_blocks_updated_at BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
    RAISE NOTICE '表：users, documents, content_blocks, document_blocks, comments, similar_blocks, document_embeddings';
    RAISE NOTICE '测试用户：admin@example.com / user@example.com';
END $$;
