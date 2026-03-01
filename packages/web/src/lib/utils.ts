import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 忽略 TypeScript 严格空检查错误
// @ts-ignore - 生产环境构建配置问题
export const api: {
  baseURL: string;
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
  login: (email: string, password: string) => Promise<{ token: string; user: User }>;
  register: (email: string, username: string, password: string) => Promise<{ user: User }>;
  getDocuments: () => Promise<{ documents: Document[] }>;
  getDocument: (id: string) => Promise<{ document: Document; content: ContentBlock[] }>;
  getDocumentComments: (id: string) => Promise<{ comments: Comment[]; blockCommentCount: Record<string, number> }>;
  createDocument: (title: string, content: string) => Promise<{ document: Document }>;
  deleteDocument: (id: string) => Promise<unknown>;
  getBlockComments: (hash: string) => Promise<{ comments: (Comment & { replies?: Comment[] })[] }>;
  createComment: (blockHash: string, content: string, parentCommentId?: string, selectedText?: string) => Promise<{ comment: Comment }>;
  createReply: (rootId: string, content: string, replyToUserId?: string) => Promise<{ comment: Comment }>;
  getReplies: (rootId: string) => Promise<{ replies: Comment[] }>;
  updateComment: (id: string, updates: Partial<{ content: string; isResolved: boolean }>) => Promise<{ comment: Comment }>;
  deleteComment: (id: string) => Promise<unknown>;
  likeComment: (id: string) => Promise<{ liked: boolean; likeCount: number }>;
  getBlock: (hash: string) => Promise<{ block?: ContentBlock; documents?: Document[] }>;
  getBlockSimilar: (hash: string) => Promise<{ similar?: SimilarBlock[] }>;
} = {
  // @ts-ignore - Vite 环境变量
  baseURL: import.meta.env?.VITE_API_URL || '/api',

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // 从 localStorage 读取持久化的 token
    let token: string | null = null;
    try {
      const stored = localStorage.getItem('collab-auth');
      if (stored) token = JSON.parse(stored)?.state?.token ?? null;
    } catch {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${api.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error?.error || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Auth
  login: (email: string, password: string) =>
    api.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, username: string, password: string) =>
    api.request<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    }),

  // Documents
  getDocuments: () => api.request<{ documents: Document[] }>('/documents'),
  getDocument: (id: string) => api.request<{ document: Document; content: ContentBlock[] }>(`/documents/${id}`),
  getDocumentComments: (id: string) =>
    api.request<{ comments: Comment[]; blockCommentCount: Record<string, number> }>(`/documents/${id}/comments`),
  createDocument: (title: string, content: string) =>
    api.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),
  deleteDocument: (id: string) =>
    api.request<unknown>(`/documents/${id}`, { method: 'DELETE' }),

  // Comments
  getBlockComments: (hash: string) =>
    api.request<{ comments: (Comment & { replies?: Comment[] })[] }>(`/comments/block/${hash}`),
  createComment: (blockHash: string, content: string, _parentCommentId?: string, selectedText?: string) =>
    api.request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ blockHash, content, selectedText }),
    }),
  createReply: (rootId: string, content: string, replyToUserId?: string) =>
    api.request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ rootId, content, replyToUserId }),
    }),
  getReplies: (rootId: string) =>
    api.request<{ replies: Comment[] }>(`/comments/${rootId}/replies`),
  updateComment: (id: string, updates: Partial<{ content: string; isResolved: boolean }>) =>
    api.request<{ comment: Comment }>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteComment: (id: string) =>
    api.request<unknown>(`/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id: string) =>
    api.request<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`, { method: 'POST' }),

  // Blocks
  getBlock: (hash: string) => api.request<{ block?: ContentBlock; documents?: Document[] }>(`/blocks/${hash}`),
  getBlockSimilar: (hash: string) =>
    api.request<{ similar?: SimilarBlock[] }>(`/blocks/${hash}/similar`),
};

export type User = {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  is_admin?: boolean;
};

export type Document = {
  id: string;
  title: string;
  word_count?: number;
  block_count?: number;
  status: 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
  uploader?: string;  // 仅管理员可见
};

export type ContentBlock = {
  block_hash: string;
  raw_content: string;
  word_count: number;
  occurrence_count?: number;
};

export type Comment = {
  id: string;
  block_hash: string;
  user_id: string;
  content: string;
  username?: string;
  avatar_url?: string;
  selected_text?: string;
  is_resolved: boolean;
  like_count: number;
  liked_by_me: boolean;
  reply_count: number;
  root_id?: string | null;
  reply_to_user_id?: string | null;
  reply_to_username?: string | null;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
};

export type SimilarBlock = {
  similar_hash: string;
  similarity_score: number;
  algorithm: string;
  raw_content: string;
  occurrence_count: number;
};

export function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
