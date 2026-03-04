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
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, username: string, password: string, code: string) =>
    request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, code }),
    }),
  sendCode: (email: string, purpose: 'register' | 'reset_password') =>
    request<{ message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
    }),
  resetPassword: (email: string, code: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),
  updateProfile: (avatarUrl: string) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatar_url: avatarUrl }),
    }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
};

// Documents
export const documents = {
  list: () =>
    request<{ documents: Document[] }>('/documents').then((r) => r.documents),
  get: (id: string, offset = 0, limit = 2000) =>
    request<{ document: Document; content: RawBlock[]; pagination?: { offset: number; limit: number; total: number; hasMore: boolean } }>(
      `/documents/${id}?offset=${offset}&limit=${limit}`
    ).then(
      (r) => ({
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
      }) as DocumentDetail & { pagination?: { offset: number; limit: number; total: number; hasMore: boolean } }
    ),
  getBlockCommentCounts: (id: string) =>
    request<{ blockCommentCount: Record<string, number> }>(`/documents/${id}/comments`)
      .then((r) => r.blockCommentCount),
  upload: async (formData: FormData) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Upload failed');
    }
    return res.json() as Promise<{ document: Document }>;
  },
};

// 与 web 端 DocumentPage.tsx 保持一致的章节正则
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

// Comments
export const comments = {
  getByBlock: (hash: string) =>
    request<{ comments: CommentWithReplies[] }>(`/comments/block/${hash}`).then(
      (r) => r.comments
    ),
  create: (body: {
    blockHash: string;
    content: string;
    rootId?: string;
    replyToUserId?: string;
  }) =>
    request<{ comment: Comment }>('/comments', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.comment),
  like: (id: string) =>
    request<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`, {
      method: 'POST',
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/comments/${id}`, { method: 'DELETE' }),
};

// Types
export interface User {
  id: number;
  email: string;
  username: string;
  is_admin: boolean;
  avatar_url?: string;
}

export interface Document {
  id: string;
  title: string;
  author?: string;
  word_count?: number;
  block_count?: number;
  status?: string;
  created_at: string;
  updated_at?: string;
}

export interface RawBlock {
  block_hash: string;
  raw_content: string;
  word_count?: number;
}

export interface Block {
  id: number;
  hash: string;
  type: string;
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
  username: string;
  content: string;
  parent_comment_id: string | null;
  root_id: string | null;
  reply_to_user_id: string | null;
  like_count: number;
  reply_count: number;
  created_at: string;
}

export interface CommentWithReplies extends Comment {
  replies?: Comment[];
}
