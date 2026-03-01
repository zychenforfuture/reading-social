import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 从 zustand-persist 的 localStorage 中读取当前 token */
function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('collab-auth');
    if (!raw) return null;
    return (JSON.parse(raw) as { state?: { token?: string } })?.state?.token ?? null;
  } catch {
    return null;
  }
}

export const api = {
  // @ts-ignore - Vite 环境变量
  baseURL: (import.meta.env?.VITE_API_URL || '/api') as string,

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = getStoredToken();
    const response = await fetch(`${api.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error?.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    api.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, username: string, password: string, code: string) =>
    api.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, code }),
    }),

  sendCode: (email: string, purpose: 'register' | 'reset_password') =>
    api.request<{ message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  resetPassword: (email: string, code: string, password: string) =>
    api.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),

  // ── Documents ─────────────────────────────────────────────────────────────
  getDocuments: () => api.request<{ documents: Document[] }>('/documents'),
  getDocument: (id: string) =>
    api.request<{ document: Document; content: ContentBlock[] }>(`/documents/${id}`),
  getDocumentComments: (id: string) =>
    api.request<{ comments: Comment[]; blockCommentCount: Record<string, number> }>(
      `/documents/${id}/comments`,
    ),
  createDocument: (title: string, content: string) =>
    api.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),
  deleteDocument: (id: string) =>
    api.request<unknown>(`/documents/${id}`, { method: 'DELETE' }),

  // ── Comments ──────────────────────────────────────────────────────────────
  getBlockComments: (hash: string) =>
    api.request<{ comments: Comment[] }>(`/comments/block/${hash}`),
  getReplies: (rootId: string) =>
    api.request<{ replies: Comment[] }>(`/comments/${rootId}/replies`),
  createComment: (
    blockHash: string,
    content: string,
    parentCommentId?: string,
    selectedText?: string,
    rootId?: string,
    replyToUserId?: string,
  ) =>
    api.request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ blockHash, content, parentCommentId, selectedText, rootId, replyToUserId }),
    }),
  updateComment: (id: string, updates: Partial<{ content: string; isResolved: boolean }>) =>
    api.request<{ comment: Comment }>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteComment: (id: string) =>
    api.request<unknown>(`/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id: string) =>
    api.request<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`, {
      method: 'POST',
    }),

  // ── Blocks ────────────────────────────────────────────────────────────────
  getBlock: (hash: string) =>
    api.request<{ block?: ContentBlock; documents?: Document[] }>(`/blocks/${hash}`),
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
  uploader?: string;
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
  user_id: string | null;
  content: string;
  username?: string;
  avatar_url?: string;
  selected_text?: string;
  is_resolved: boolean;
  like_count?: number;
  liked_by_me?: boolean;
  reply_count?: number;
  reply_to_username?: string;
  root_id?: string | null;
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
