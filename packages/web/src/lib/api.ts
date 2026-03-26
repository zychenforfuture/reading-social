/// <reference types="vite/client" />
import type {
  User,
  Document,
  ContentBlock,
  Comment,
  Notification,
  SimilarBlock,
  Pagination,
  AdminStats,
  AdminUser,
  AdminDocument,
  AdminComment,
} from './types.js';

export const api: {
  baseURL: string;
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
  login: (email: string, password: string) => Promise<{ token: string; user: User }>;
  register: (email: string, username: string, password: string, code: string) => Promise<{ message: string }>;
  sendCode: (email: string, purpose: 'register' | 'reset_password') => Promise<{ message: string }>;
  resetPassword: (email: string, code: string, password: string) => Promise<{ message: string }>;
  getDocuments: () => Promise<{ documents: Document[] }>;
  getDocument: (id: string, offset?: number, limit?: number) => Promise<{ document: Document; content: ContentBlock[]; pagination: { offset: number; limit: number; total: number; hasMore: boolean } }>;
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
  updateProfile: (avatarUrl: string) => Promise<{ user: User }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ message: string }>;
  getUnreadNotificationCount: () => Promise<{ count: number }>;
  getNotifications: (params?: { unread?: boolean; limit?: number; offset?: number }) => Promise<{ notifications: Notification[]; total: number }>;
  markNotificationRead: (id: string) => Promise<unknown>;
  markAllNotificationsRead: () => Promise<unknown>;
  markNotificationsReadBatch: (ids: string[]) => Promise<unknown>;
  deleteNotification: (id: string) => Promise<unknown>;
  deleteNotificationsBatch: (ids: string[]) => Promise<unknown>;
  getAdminStats: () => Promise<AdminStats>;
  getAdminUsers: (params?: { page?: number; limit?: number; search?: string }) => Promise<{ users: AdminUser[]; pagination: Pagination }>;
  updateAdminUser: (id: string, updates: { is_admin?: boolean }) => Promise<{ user: User }>;
  deleteAdminUser: (id: string) => Promise<{ message: string }>;
  getAdminDocuments: (params?: { page?: number; limit?: number; status?: string; search?: string }) => Promise<{ documents: AdminDocument[]; pagination: Pagination }>;
  deleteAdminDocument: (id: string) => Promise<{ message: string }>;
  getAdminComments: (params?: { page?: number; limit?: number; search?: string }) => Promise<{ comments: AdminComment[]; pagination: Pagination }>;
  deleteAdminComment: (id: string) => Promise<{ message: string }>;
} = {
  baseURL: import.meta.env?.VITE_API_URL || '/api',

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    let token: string | null = null;
    try {
      const stored = localStorage.getItem('collab-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.state?.token ?? parsed?.token ?? null;
      }
    } catch {}

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${api.baseURL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error?.error || `HTTP ${response.status}: ${error?.message || ''}`);
    }

    return response.json();
  },

  login: (email, password) =>
    api.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email, username, password, code) =>
    api.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, code }),
    }),

  sendCode: (email, purpose) =>
    api.request<{ message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),

  resetPassword: (email, code, password) =>
    api.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),

  getDocuments: () => api.request<{ documents: Document[] }>('/documents'),

  getDocument: (id, offset = 0, limit = 5000) =>
    api.request<{ document: Document; content: ContentBlock[]; pagination: { offset: number; limit: number; total: number; hasMore: boolean } }>(
      `/documents/${id}?offset=${offset}&limit=${limit}`
    ),

  getDocumentComments: (id) =>
    api.request<{ comments: Comment[]; blockCommentCount: Record<string, number> }>(`/documents/${id}/comments`),

  createDocument: (title, content) =>
    api.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  deleteDocument: (id) =>
    api.request<unknown>(`/documents/${id}`, { method: 'DELETE' }),

  getBlockComments: (hash) =>
    api.request<{ comments: (Comment & { replies?: Comment[] })[] }>(`/comments/block/${hash}`),

  createComment: (blockHash, content, _parentCommentId, selectedText) =>
    api.request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ blockHash, content, selectedText }),
    }),

  createReply: (rootId, content, replyToUserId) =>
    api.request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify({ rootId, content, replyToUserId }),
    }),

  getReplies: (rootId) =>
    api.request<{ replies: Comment[] }>(`/comments/${rootId}/replies`),

  updateComment: (id, updates) =>
    api.request<{ comment: Comment }>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteComment: (id) =>
    api.request<unknown>(`/comments/${id}`, { method: 'DELETE' }),

  likeComment: (id) =>
    api.request<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`, { method: 'POST' }),

  getBlock: (hash) =>
    api.request<{ block?: ContentBlock; documents?: Document[] }>(`/blocks/${hash}`),

  getBlockSimilar: (hash) =>
    api.request<{ similar?: SimilarBlock[] }>(`/blocks/${hash}/similar`),

  updateProfile: (avatarUrl) =>
    api.request<{ user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify({ avatar_url: avatarUrl }) }),

  changePassword: (oldPassword, newPassword) =>
    api.request<{ message: string }>('/auth/change-password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),

  getUnreadNotificationCount: () =>
    api.request<{ count: number }>('/notifications/unread-count'),

  getNotifications: (params) => {
    const q = new URLSearchParams();
    if (params?.unread !== undefined) q.set('unread', String(params.unread));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset !== undefined) q.set('offset', String(params.offset));
    const qs = q.toString();
    return api.request<{ notifications: Notification[]; total: number }>(`/notifications${qs ? '?' + qs : ''}`);
  },

  markNotificationRead: (id) =>
    api.request<unknown>(`/notifications/${id}/read`, { method: 'PUT' }),

  markAllNotificationsRead: () =>
    api.request<unknown>('/notifications/read-all', { method: 'PUT' }),

  markNotificationsReadBatch: (ids) =>
    api.request<unknown>('/notifications/read-batch', { method: 'PUT', body: JSON.stringify({ ids }) }),

  deleteNotification: (id) =>
    api.request<unknown>(`/notifications/${id}`, { method: 'DELETE' }),

  deleteNotificationsBatch: (ids) =>
    api.request<unknown>('/notifications/delete-batch', { method: 'POST', body: JSON.stringify({ ids }) }),

  getAdminStats: () => api.request<AdminStats>('/admin/stats'),

  getAdminUsers: (params) => {
    const q = new URLSearchParams();
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return api.request<{ users: AdminUser[]; pagination: Pagination }>(`/admin/users${qs ? '?' + qs : ''}`);
  },

  updateAdminUser: (id, updates) =>
    api.request<{ user: User }>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  deleteAdminUser: (id) =>
    api.request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),

  getAdminDocuments: (params) => {
    const q = new URLSearchParams();
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return api.request<{ documents: AdminDocument[]; pagination: Pagination }>(`/admin/documents${qs ? '?' + qs : ''}`);
  },

  deleteAdminDocument: (id) =>
    api.request<{ message: string }>(`/admin/documents/${id}`, { method: 'DELETE' }),

  getAdminComments: (params) => {
    const q = new URLSearchParams();
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return api.request<{ comments: AdminComment[]; pagination: Pagination }>(`/admin/comments${qs ? '?' + qs : ''}`);
  },

  deleteAdminComment: (id) =>
    api.request<{ message: string }>(`/admin/comments/${id}`, { method: 'DELETE' }),
};

const likePending = new Map<string, { count: number; timer?: ReturnType<typeof setTimeout> }>();

export function likeCommentWithDebounce(commentId: string): Promise<{ liked: boolean; likeCount: number }> {
  const current = likePending.get(commentId) || { count: 0 };
  current.count += 1;
  likePending.set(commentId, current);

  if (current.timer) {
    clearTimeout(current.timer);
  }

  return new Promise((resolve, reject) => {
    current.timer = setTimeout(async () => {
      try {
        const pending = likePending.get(commentId);
        if (!pending || pending.count === 0) {
          resolve({ liked: false, likeCount: 0 });
          return;
        }

        const result = await api.likeComment(commentId);
        likePending.delete(commentId);
        resolve(result);
      } catch (err) {
        likePending.delete(commentId);
        reject(err);
      }
    }, 300);
  });
}