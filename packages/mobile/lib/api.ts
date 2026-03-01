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
};

// Documents
export const documents = {
  list: () =>
    request<{ documents: Document[] }>('/documents').then((r) => r.documents),
  get: (id: number) =>
    request<{ document: Document; content: RawBlock[] }>(`/documents/${id}`).then(
      (r) => ({
        ...r.document,
        blocks: (r.content || []).map((b, i) => ({
          id: i,
          hash: b.block_hash,
          type: detectBlockType(b.raw_content),
          content: b.raw_content,
          order_index: i,
          heading_level: getHeadingLevel(b.raw_content),
          word_count: b.word_count,
        })),
      }) as DocumentDetail
    ),
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

function detectBlockType(content: string): string {
  if (/^#{1,6}\s/.test(content)) return 'heading';
  return 'paragraph';
}

function getHeadingLevel(content: string): number | undefined {
  const m = content.match(/^(#{1,6})\s/);
  return m ? m[1].length : undefined;
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
}

export interface Document {
  id: number;
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
