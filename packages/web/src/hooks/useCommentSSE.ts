import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type Comment } from '../lib/utils';

interface SSEEvent {
  type: 'new_comment' | 'new_reply' | 'like_updated';
  comment?: Comment;
  reply?: Comment;
  rootId?: string;
  commentId?: string;
  likeCount?: number;
}

/**
 * 订阅文档评论的 SSE 实时推送。
 * - new_comment / new_reply：直接将数据注入缓存，无需重新请求
 * - like_updated：更新缓存中对应评论的 like_count
 */
export function useCommentSSE(documentId: string | undefined) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const url = `${api.baseURL}/comments/stream/${documentId}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (ev) => {
      if (!ev.data || ev.data.startsWith(':')) return; // heartbeat
      let event: SSEEvent;
      try {
        event = JSON.parse(ev.data) as SSEEvent;
      } catch {
        return;
      }

      const queryKey = ['document-comments', documentId];

      if (event.type === 'new_comment' && event.comment) {
        const newComment = event.comment;
        queryClient.setQueryData<{
          comments: Comment[];
          blockCommentCount: Record<string, number>;
        }>(queryKey, (old) => {
          if (!old) return old;
          // 避免重复插入
          if (old.comments.some((c) => c.id === newComment.id)) return old;
          const updated = [...old.comments, newComment];
          const blockCommentCount = { ...old.blockCommentCount };
          blockCommentCount[newComment.block_hash] =
            (blockCommentCount[newComment.block_hash] ?? 0) + 1;
          return { comments: updated, blockCommentCount };
        });
      } else if (event.type === 'new_reply' && event.reply) {
        const reply = event.reply;
        queryClient.setQueryData<{
          comments: Comment[];
          blockCommentCount: Record<string, number>;
        }>(queryKey, (old) => {
          if (!old) return old;
          if (old.comments.some((c) => c.id === reply.id)) return old;
          // 同时更新根评论的 reply_count
          const updated = old.comments.map((c) => {
            if (c.id === event.rootId) {
              return { ...c, reply_count: (c.reply_count ?? 0) + 1 };
            }
            return c;
          });
          return { comments: [...updated, reply], blockCommentCount: old.blockCommentCount };
        });
      } else if (event.type === 'like_updated' && event.commentId !== undefined) {
        const { commentId, likeCount } = event;
        queryClient.setQueryData<{
          comments: Comment[];
          blockCommentCount: Record<string, number>;
        }>(queryKey, (old) => {
          if (!old) return old;
          const updated = old.comments.map((c) =>
            c.id === commentId ? { ...c, like_count: likeCount ?? c.like_count } : c,
          );
          return { ...old, comments: updated };
        });
      }
    };

    es.onerror = () => {
      // 连接断开后自动重连（EventSource 默认行为）
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [documentId, queryClient]);
}
