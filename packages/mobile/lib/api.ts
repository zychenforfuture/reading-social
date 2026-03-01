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
  list: () => request<Document[]>('/documents'),
  get: (id: number) => request<DocumentDetail>(`/documents/${id}`),
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
    return res.json() as Promise<Document>;
  },
};

// Comments
export const comments = {
  getByBlock: (hash: string) =>
    request<Comment[]>(`/comments/block/${hash}`),
  create: (body: {
    block_hash: string;
    content: string;
    parent_id?: number;
    root_id?: number;
  }) =>
    request<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  like: (id: number) =>
    request<{ liked: boolean; count: number }>(`/comments/${id}/like`, {
      method: 'POST',
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/comments/${id}`, { method: 'DELETE' }),
  getReplies: (rootId: number) =>
    request<Comment[]>(`/comments/${rootId}/replies`),
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
  author: string;
  created_at: string;
  block_count?: number;
}

export interface Block {
  id: number;
  hash: string;
  type: string;
  content: string;
  order_index: number;
  heading_level?: number;
}

export interface DocumentDetail extends Document {
  blocks: Block[];
}

export interface Comment {
  id: number;
  block_hash: string;
  user_id: number;
  username: string;
  content: string;
  parent_id: number | null;
  root_id: number | null;
  like_count: number;
  is_liked: boolean;
  reply_count: number;
  created_at: string;
}
