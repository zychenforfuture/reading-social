import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn, timeAgo } from '../../lib/utils';
import { useUserStore } from '../../stores/userStore';
import { Avatar } from './Avatar';
import { ThumbsUp, CornerDownRight, ChevronDown, ChevronUp, X, Send } from 'lucide-react';

interface ReplySectionProps {
  comment: Comment;
  documentId: string;
  currentUser: { id: string; username?: string; is_admin?: boolean } | null;
  onLikeRoot: () => void;
  onDeleteRoot: () => void;
  canDeleteRoot: boolean;
}

export default function ReplySection({
  comment,
  documentId,
  currentUser,
  onLikeRoot,
  onDeleteRoot,
  canDeleteRoot,
}: ReplySectionProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ userId: string; username: string } | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 展开时才加载回复列表
  const { data, isLoading } = useQuery({
    queryKey: ['replies', comment.id],
    queryFn: () => api.getReplies(comment.id),
    enabled: expanded,
    staleTime: 30000,
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      api.createReply(comment.id, content, replyingTo?.userId),
    onSuccess: () => {
      setText('');
      setShowInput(false);
      setReplyingTo(null);
      // 列表和 reply_count 由 SSE new_reply 统一更新，避免发送者本人重复追加
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData(['replies', comment.id], (old: { replies: Comment[] } | undefined) => ({
        replies: (old?.replies ?? []).filter((r) => r.id !== deletedId),
      }));
      queryClient.setQueryData(
        ['document-comments', documentId],
        (old: { comments: Comment[]; blockCommentCount: Record<string, number> } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            comments: old.comments.map((c) =>
              c.id === comment.id ? { ...c, reply_count: Math.max(0, c.reply_count - 1) } : c
            ),
          };
        }
      );
    },
  });

  // 回复点赞（乐观更新 + 快照回滚）
  const likeMutation = useMutation({
    mutationFn: (replyId: string) => api.likeComment(replyId),
    onMutate: async (replyId: string) => {
      await queryClient.cancelQueries({ queryKey: ['replies', comment.id] });
      const previous = queryClient.getQueryData<{ replies: Comment[] }>(['replies', comment.id]);
      queryClient.setQueryData(['replies', comment.id], (old: { replies: Comment[] } | undefined) => {
        if (!old) return old;
        return {
          replies: old.replies.map((r) =>
            r.id === replyId
              ? { ...r, liked_by_me: !r.liked_by_me, like_count: r.liked_by_me ? r.like_count - 1 : r.like_count + 1 }
              : r
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _replyId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['replies', comment.id], context.previous);
      }
    },
    onSuccess: (data, replyId) => {
      queryClient.setQueryData(['replies', comment.id], (old: { replies: Comment[] } | undefined) => {
        if (!old) return old;
        return {
          replies: old.replies.map((r) =>
            r.id === replyId ? { ...r, liked_by_me: data.liked, like_count: data.likeCount } : r
          ),
        };
      });
    },
  });

  const replyCount = comment.reply_count;

  const startReplyTo = (userId: string, username: string) => {
    setReplyingTo({ userId, username });
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="mt-1.5">
      {/* 操作行：点赞/回复/删除 同一行，附带展开回复 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onLikeRoot}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors',
            comment.liked_by_me ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ThumbsUp className={cn('h-3 w-3', comment.liked_by_me && 'fill-current')} />
          {comment.like_count > 0 && <span>{comment.like_count}</span>}
        </button>
        <button
          onClick={() => {
            setReplyingTo(null);
            setShowInput(!showInput);
            if (!showInput) setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <CornerDownRight className="h-3 w-3" />
          回复
        </button>
        {canDeleteRoot && (
          <button
            onClick={onDeleteRoot}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            删除
          </button>
        )}
        {replyCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? '收起' : `查看 ${replyCount} 条回复`}
          </button>
        )}
      </div>

      {/* 回复输入框 */}
      {showInput && (
        <div className="mt-2 space-y-1">
          {replyingTo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground px-0.5">
              <CornerDownRight className="h-3 w-3 shrink-0" />
              回复
              <span className="font-medium text-foreground">{replyingTo.username}</span>
              <button onClick={() => setReplyingTo(null)} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
                  replyMutation.mutate(text.trim());
                }
                if (e.key === 'Escape') { setShowInput(false); setText(''); setReplyingTo(null); }
              }}
              rows={2}
              placeholder={replyingTo ? `回复 ${replyingTo.username}… (⌘Enter 发送)` : '写下回复… (⌘Enter 发送)'}
              className="flex-1 resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => { if (text.trim()) replyMutation.mutate(text.trim()); }}
              disabled={!text.trim() || replyMutation.isPending}
              className="h-7 w-7 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* 回复列表 */}
      {expanded && (
        <div className="mt-2 space-y-2 pl-1 border-l-2 border-muted">
          {isLoading && <p className="text-xs text-muted-foreground pl-2">加载中…</p>}
          {(data?.replies ?? []).map((reply) => (
            <div key={reply.id} className="flex gap-2 group/reply pl-2">
              <Avatar name={reply.username || '匿名'} avatarUrl={reply.avatar_url} size="small" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">{reply.username || '匿名用户'}</span>
                  {reply.reply_to_username && (
                    <span className="text-xs text-muted-foreground">@ {reply.reply_to_username}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed break-words mt-0.5">{reply.content}</p>
                <div className="flex items-center gap-3 mt-1">
                  {/* 点赞 */}
                  <button
                    onClick={() => currentUser && likeMutation.mutate(reply.id)}
                    className={cn(
                      'flex items-center gap-1 text-xs transition-colors',
                      reply.liked_by_me ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {reply.like_count > 0 && <span>{reply.like_count}</span>}
                  </button>
                  {/* 回复此回复 */}
                  <button
                    onClick={() => startReplyTo(reply.user_id, reply.username || '匿名用户')}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CornerDownRight className="h-3 w-3" />
                    回复
                  </button>
                  {/* 删除（自己或管理员） */}
                  {(currentUser?.is_admin || reply.user_id === currentUser?.id) && (
                    <button
                      onClick={() => window.confirm('确认删除这条评论？') && deleteMutation.mutate(reply.id)}
                      className="text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover/reply:opacity-100 transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}