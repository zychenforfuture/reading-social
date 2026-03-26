import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Comment } from '../lib/utils';

export function useCommentSSE(documentId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!documentId) return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    const MAX_RETRIES = 10;

    const connect = () => {
      let token = '';
      try {
        const stored = localStorage.getItem('collab-auth');
        if (stored) token = JSON.parse(stored)?.state?.token ?? '';
      } catch {}

      if (token) {
        document.cookie = `auth_token=${token}; path=/api; SameSite=Lax`;
      }

      const url = `/api/comments/stream/${documentId}`;
      es = new EventSource(url, { withCredentials: true });

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'like_updated') {
            queryClient.setQueryData(
              ['document-comments', documentId],
              (old: { comments: Comment[]; blockCommentCount: Record<string, number> } | undefined) => {
                if (!old) return old;
                return {
                  ...old,
                  comments: old.comments.map((c: Comment) =>
                    c.id === data.commentId ? { ...c, like_count: data.likeCount } : c
                  ),
                };
              }
            );
          } else if (data.type === 'new_reply') {
            queryClient.setQueryData(
              ['document-comments', documentId],
              (old: { comments: Comment[]; blockCommentCount: Record<string, number> } | undefined) => {
                if (!old) return old;
                return {
                  ...old,
                  comments: old.comments.map((c: Comment) =>
                    c.id === data.rootId ? { ...c, reply_count: c.reply_count + 1 } : c
                  ),
                };
              }
            );
            queryClient.setQueryData(
              ['replies', data.rootId],
              (old: { replies: Comment[] } | undefined) => {
                if (!old) return old;
                const exists = old.replies.some((r: Comment) => r.id === data.reply?.id);
                if (exists) return old;
                return { replies: [...old.replies, data.reply] };
              }
            );
          } else {
            queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] });
          }
        } catch {
          queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] });
        }
      };

      es.onopen = () => { retries = 0; };

      es.onerror = () => {
        es?.close();
        if (retries < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** retries, 30000);
          retries++;
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [documentId, queryClient]);
}
