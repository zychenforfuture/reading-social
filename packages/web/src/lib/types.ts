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

export type Notification = {
  id: string;
  user_id: string;
  type: 'reply' | 'mention' | 'like';
  title: string;
  content?: string;
  data?: {
    commentId?: string;
    documentId?: string;
    documentTitle?: string;
    blockHash?: string;
    originalContent?: string;
    selectedText?: string;
  };
  is_read: boolean;
  created_at: string;
};

export type SimilarBlock = {
  similar_hash: string;
  similarity_score: number;
  algorithm: string;
  raw_content: string;
  occurrence_count: number;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminStats = {
  users: {
    total: number;
    admins: number;
    recent: number;
  };
  documents: {
    total: number;
    ready: number;
    processing: number;
    error: number;
    totalWords: number;
    recent: number;
  };
  comments: {
    total: number;
    recent: number;
  };
  blocks: {
    total: number;
  };
};

export type AdminUser = User & {
  document_count: number;
  comment_count: number;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminDocument = Document & {
  uploader: string;
  uploader_email: string;
  comment_count: number;
};

export type AdminComment = Comment & {
  email: string;
  block_content: string;
};