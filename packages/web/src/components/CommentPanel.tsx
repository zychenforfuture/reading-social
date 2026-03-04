import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn, timeAgo } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { X, ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp, CornerDownRight, Flame, Clock } from 'lucide-react';

interface CommentPanelProps {
  documentId: string;
  comments: Comment[];
  blockCommentCount: Record<string, number>;
  selectedBlock: { hash: string; text: string } | null;
  onClearSelection: () => void;
  open: boolean;
  onClose: () => void;
  focusCommentIds?: string[] | null;
  onClearFocus?: () => void;
}

export function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100"
      />
    );
  }
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0', color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SmallAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-5 h-5 rounded-full object-cover shrink-0 border border-gray-100"
      />
    );
  }
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0', color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── 回复区域（内联展开，每条根评论下方）────────────────────────────
export function ReplySection({
  comment,
  documentId,
  currentUser,
}: {
  comment: Comment;
  documentId: string;
  currentUser: { id: string; username?: string; is_admin?: boolean } | null;
}) {
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
      {/* 操作行：回复按钮 + 展开按钮 */}
      <div className="flex items-center gap-3">
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
              <SmallAvatar name={reply.username || '匿名'} avatarUrl={reply.avatar_url} />
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
                      onClick={() => deleteMutation.mutate(reply.id)}
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

/**
 * 判断评论是否属于当前选中片段。
 * groupBlocks 后多句合并为同一 block_hash，需用 selected_text 做二次过滤：
 * 只展示 selected_text 与当前选区有文字重叠的评论（或没有 selected_text 的块级评论）。
 */
function matchesSelection(c: Comment, sel: { hash: string; text: string }): boolean {
  if (c.block_hash !== sel.hash) return false;
  if (!c.selected_text) return true; // 针对整个块的评论，也展示
  const probe = sel.text.trim().substring(0, 15);
  const st = c.selected_text.trim();
  // 选区包含评论锚点，或评论锚点包含选区前缀 → 有重叠
  return st.includes(probe) || sel.text.includes(st.substring(0, 15));
}

export default function CommentPanel({
  documentId,
  comments,
  selectedBlock,
  onClearSelection,
  open,
  onClose,
  focusCommentIds,
  onClearFocus,
}: CommentPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [newComment, setNewComment] = useState('');
  const [sortMode, setSortMode] = useState<'hot' | 'newest'>('hot');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBlock && open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedBlock, open]);

  // 切换焦点评论组时滚动到顶部
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [focusCommentIds]);

  // 选中新段落（发评论模式）时也滚动到顶部
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedBlock?.hash]);

  // 选中新段落时清空输入
  useEffect(() => {
    setNewComment('');
  }, [selectedBlock]);

  type CommentsCache = { comments: Comment[]; blockCommentCount: Record<string, number> };

  const createMutation = useMutation({
    mutationFn: (content: string) => {
      if (!selectedBlock) throw new Error('No block selected');
      return api.createComment(selectedBlock.hash, content, undefined, selectedBlock.text);
    },
    onSuccess: ({ comment }) => {
      // 直接写入缓存，新评论立即可见（不等 network round trip）
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        const newCount = { ...old.blockCommentCount, [comment.block_hash]: (old.blockCommentCount[comment.block_hash] ?? 0) + 1 };
        return { comments: [...old.comments, comment], blockCommentCount: newCount };
      });
      setNewComment('');
      // 清除 focusCommentIds，切换到 selectedBlock 模式，此时新评论已在缓存里
      onClearFocus?.();
    },
  });

  const likeMutation = useMutation({
    mutationFn: (commentId: string) => api.likeComment(commentId),
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['document-comments', documentId] });
      const previous = queryClient.getQueryData<CommentsCache>(['document-comments', documentId]);
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.id === commentId
              ? { ...c, liked_by_me: !c.liked_by_me, like_count: c.liked_by_me ? c.like_count - 1 : c.like_count + 1 }
              : c
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['document-comments', documentId], context.previous);
      }
    },
    onSuccess: (data, commentId) => {
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.id === commentId ? { ...c, liked_by_me: data.liked, like_count: data.likeCount } : c
          ),
        };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] }),
  });

  const handleSubmit = () => {
    if (!newComment.trim() || !selectedBlock) return;
    createMutation.mutate(newComment.trim());
  };

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* 抽屉面板 */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">评论</span>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {focusCommentIds
                ? `${focusCommentIds.length} 条`
                : selectedBlock
                  ? `${comments.filter(c => matchesSelection(c, selectedBlock)).length} 条`
                  : `${comments.length} 条`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* 排序切换：最热 / 最新 */}
            <div className="flex items-center rounded-md border text-xs overflow-hidden mr-1">
              <button
                onClick={() => setSortMode('hot')}
                className={cn('flex items-center gap-0.5 px-2 py-1 transition-colors', sortMode === 'hot' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted')}
              >
                <Flame className="h-3 w-3" />
                最热
              </button>
              <button
                onClick={() => setSortMode('newest')}
                className={cn('flex items-center gap-0.5 px-2 py-1 transition-colors', sortMode === 'newest' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted')}
              >
                <Clock className="h-3 w-3" />
                最新
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 overflow-y-auto py-2" ref={listRef}>
          {(() => {
            // 三种过滤模式
            // 1. 气泡点击：只显示该行的 commentIds
            // 2. 选中文字发评论：只显示该 block 的评论
            // 3. 无 focus：显示全部
            const focusSet = focusCommentIds ? new Set(focusCommentIds) : null;
            const baseComments = focusSet
              ? comments.filter(c => focusSet.has(c.id))
              : selectedBlock
                ? comments.filter(c => matchesSelection(c, selectedBlock))
                : comments;
            // 最热：保持 API 返回的热度排序；最新：按发表时间倒序
            const displayComments = sortMode === 'newest'
              ? [...baseComments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              : baseComments;

            const isFocused = !!focusCommentIds || !!selectedBlock;

            // 全局无评论（整个文档）
            if (comments.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <p className="text-sm">还没有评论</p>
                  <p className="text-xs opacity-60">选中文字后点击「评论」</p>
                </div>
              );
            }

            const renderComment = (comment: Comment, highlighted = false) => (
              <div
                key={comment.id}
                className={cn(
                  'px-4 py-3 transition-colors group',
                  highlighted ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30' : 'hover:bg-muted/30',
                )}
              >
                <div className="flex gap-2.5">
                  <Avatar name={comment.username || '匿名'} avatarUrl={comment.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {comment.username || '匿名用户'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(comment.created_at)}
                      </span>
                    </div>
                    {comment.selected_text && (
                      <div className="mb-1.5 pl-2 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground line-clamp-2">
                        {comment.selected_text}
                      </div>
                    )}
                    <p className="text-sm text-foreground leading-relaxed break-words">
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => likeMutation.mutate(comment.id)}
                        className={cn(
                          'flex items-center gap-1 text-xs transition-colors',
                          comment.liked_by_me ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <ThumbsUp className={cn('h-3 w-3', comment.liked_by_me && 'fill-current')} />
                        {comment.like_count > 0 && <span>{comment.like_count}</span>}
                      </button>
                      {(user?.is_admin || comment.user_id === user?.id) && (
                        <button
                          onClick={() => deleteMutation.mutate(comment.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          删除
                        </button>
                      )}
                    </div>
                    <ReplySection comment={comment} documentId={documentId} currentUser={user} />
                  </div>
                </div>
              </div>
            );

            // focus 模式：按 selected_text 分组合并
            const renderGrouped = () => {
              if (displayComments.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <MessageSquare className="h-6 w-6 opacity-30" />
                    <p className="text-sm">此段暂无评论</p>
                  </div>
                );
              }
              const groupMap = new Map<string, Comment[]>();
              for (const c of displayComments) {
                const key = c.selected_text?.trim() ?? '';
                const arr = groupMap.get(key);
                if (arr) arr.push(c);
                else groupMap.set(key, [c]);
              }
              return Array.from(groupMap.entries()).map(([key, groupComments]) => (
                <div key={key || '__no_text__'} className="px-4 py-3 bg-orange-50/60 dark:bg-orange-900/15 border-b last:border-b-0">
                  {key && (
                    <div className="mb-2 pl-2 border-l-2 border-orange-300 text-xs text-muted-foreground line-clamp-3">
                      {key}
                    </div>
                  )}
                  <div className="space-y-3">
                    {groupComments.map(comment => (
                      <div key={comment.id} className="group">
                        <div className="flex gap-2.5">
                          <Avatar name={comment.username || '匿名'} avatarUrl={comment.avatar_url} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-sm font-medium truncate">
                                {comment.username || '匿名用户'}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {timeAgo(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed break-words">
                              {comment.content}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <button
                                onClick={() => likeMutation.mutate(comment.id)}
                                className={cn(
                                  'flex items-center gap-1 text-xs transition-colors',
                                  comment.liked_by_me ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                <ThumbsUp className={cn('h-3 w-3', comment.liked_by_me && 'fill-current')} />
                                {comment.like_count > 0 && <span>{comment.like_count}</span>}
                              </button>
                              {(user?.is_admin || comment.user_id === user?.id) && (
                                <button
                                  onClick={() => deleteMutation.mutate(comment.id)}
                                  className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  删除
                                </button>
                              )}
                            </div>
                            <ReplySection comment={comment} documentId={documentId} currentUser={user} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            };

            return (
              <div className="divide-y">
                {isFocused && (
                  <div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20">
                    <span className="text-xs font-medium text-orange-600">
                      此段评论 {displayComments.length} 条
                    </span>
                  </div>
                )}
                {isFocused ? renderGrouped() : displayComments.map(c => renderComment(c, false))}
              </div>
            );
          })()}
        </div>

        {/* 底部输入区 */}
        <div className="border-t bg-white dark:bg-zinc-900 px-4 py-3 space-y-2">
          {/* 当前引用 */}
          {selectedBlock && (
            <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex-1 line-clamp-2 border-l-2 border-primary pl-2 leading-relaxed">
                {selectedBlock.text}
              </div>
              <button onClick={onClearSelection} className="shrink-0 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={!selectedBlock}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              rows={2}
              placeholder={selectedBlock ? '写下你的评论… (⌘Enter 发送)' : '选中文字后发表评论'}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || !selectedBlock || createMutation.isPending}
              className="h-9 w-9 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

