/**
 * 移动端 API 客户端
 * 与 Web 端和后端 API 保持完全一致
 */

import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

// ==================== 认证模块 ====================

export const auth = {
  /**
   * 发送验证码
   */
  sendCode: (email: string, purpose: 'register' | 'reset_password') =>
    request<{ message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  /**
   * 注册账号
   */
  register: (email: string, username: string, password: string, code: string) =>
    request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, code }),
    }),

  /**
   * 登录
   */
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /**
   * 重置密码
   */
  resetPassword: (email: string, code: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),

  /**
   * 获取当前用户信息
   */
  me: () =>
    request<{ user: User }>('/auth/me'),

  /**
   * 更新个人资料（头像）
   * 注意：后端使用 PUT 方法，不是 PATCH
   */
  updateProfile: (avatarUrl: string) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PUT',  // 修复：后端使用 PUT
      body: JSON.stringify({ avatar_url: avatarUrl }),  // 修复：下划线格式
    }),

  /**
   * 修改密码
   * 注意：后端使用 camelCase 字段，不是 snake_case
   */
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'PUT',  // 修复：后端使用 PUT
      body: JSON.stringify({ 
        oldPassword,  // 修复：camelCase
        newPassword 
      }),
    }),
};

// ==================== 文档模块 ====================

// 与 Web 端保持一致的章节正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+)/i;
// Markdown 标题
const MD_HEADING_RE = /^(#{1,6})\s/;

function detectBlockType(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  if (MD_HEADING_RE.test(firstLine)) return 'heading';
  if (CHAPTER_RE.test(firstLine)) return 'heading';
  return 'paragraph';
}

function getHeadingLevel(content: string): number | undefined {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  const mdMatch = firstLine.match(MD_HEADING_RE);
  if (mdMatch) return mdMatch[1].length;
  if (CHAPTER_RE.test(firstLine)) return 1;
  return undefined;
}

export const documents = {
  /**
   * 获取文档列表
   */
  list: () =>
    request<{ documents: Document[] }>('/documents').then((r) => r.documents),

  /**
   * 获取单个文档内容（支持分页）
   */
  get: (id: string, offset = 0, limit = 2000) =>
    request<{ 
      document: Document; 
      content: RawBlock[]; 
      pagination: { offset: number; limit: number; total: number; hasMore: boolean } 
    }>(
      `/documents/${id}?offset=${offset}&limit=${limit}`
    ).then((r) => ({
      ...r.document,
      pagination: r.pagination,
      blocks: (r.content || []).map((b, i) => ({
        id: offset + i,
        hash: b.block_hash,
        type: detectBlockType(b.raw_content),
        content: b.raw_content,
        order_index: offset + i,
        heading_level: getHeadingLevel(b.raw_content),
        word_count: b.word_count,
      })),
    }) as DocumentDetail & { pagination: { offset: number; limit: number; total: number; hasMore: boolean } }),

  /**
   * 获取文档评论分布
   */
  getComments: (id: string) =>
    request<{ 
      comments: Comment[]; 
      blockCommentCount: Record<string, number> 
    }>(`/documents/${id}/comments`),

  /**
   * 上传文档
   * 注意：需要使用 FormData
   */
  upload: async (title: string, content: string) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || 'Upload failed');
    }
    return res.json() as Promise<{ document: Document }>;
  },

  /**
   * 删除文档
   */
  delete: (id: string) =>
    request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),
};

// ==================== 评论模块 ====================

export const comments = {
  /**
   * 获取内容块的所有评论
   */
  getByBlock: (hash: string) =>
    request<{ comments: (Comment & { replies?: Comment[] })[] }>(`/comments/block/${hash}`)
      .then((r) => r.comments),

  /**
   * 获取根评论的所有回复
   */
  getReplies: (rootId: string) =>
    request<{ replies: Comment[] }>(`/comments/${rootId}/replies`),

  /**
   * 创建评论（根评论或回复）
   */
  create: (body: {
    blockHash?: string;      // 根评论必填
    content: string;
    rootId?: string;         // 回复时必填
    replyToUserId?: string;  // @某人（可选）
    selectedText?: string;   // 选中的文字（可选）
  }) =>
    request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.comment),

  /**
   * 更新评论
   */
  update: (id: string, updates: { content?: string; isResolved?: boolean }) =>
    request<{ comment: Comment }>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  /**
   * 删除评论
   */
  delete: (id: string) =>
    request<{ message: string }>(`/comments/${id}`, { method: 'DELETE' }),

  /**
   * 点赞/取消点赞评论
   */
  like: (id: string) =>
    request<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`, {
      method: 'POST',
    }),
};

// ==================== 类型定义 ====================

export interface User {
  id: string;        // 修复：UUID 字符串，不是 number
  email: string;
  username: string;
  is_admin: boolean;
  avatar_url?: string | null;
}

export interface Document {
  id: string;
  title: string;
  word_count?: number;
  block_count?: number;
  status: 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at?: string;
  uploader?: string;  // 仅管理员可见
}

export interface RawBlock {
  block_hash: string;
  raw_content: string;
  word_count?: number;
  occurrence_count?: number;
}

export interface Block {
  id: number;
  hash: string;
  type: 'heading' | 'paragraph' | string;
  content: string;
  order_index: number;
  heading_level?: number;
  word_count?: number;
}

export interface DocumentDetail extends Document {
  blocks: Block[];
}

export interface Comment {
  id: string;
  block_hash: string;
  user_id: string;
  username?: string;
  avatar_url?: string | null;
  content: string;
  selected_text?: string | null;
  sentence_hash?: string | null;
  is_resolved: boolean;
  like_count: number;
  liked_by_me?: boolean;
  reply_count: number;
  root_id?: string | null;
  reply_to_user_id?: string | null;
  reply_to_username?: string | null;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export interface CommentWithReplies extends Comment {
  replies?: Comment[];
}

// ==================== 工具函数 ====================

/**
 * 格式化时间（相对时间）
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 存储 Token 到安全存储
 */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('auth_token', token);
}

/**
 * 清除存储的 Token
 */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}
