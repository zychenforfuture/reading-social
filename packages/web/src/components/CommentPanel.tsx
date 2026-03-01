import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn, timeAgo } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { X, ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface CommentPanelProps {
  documentId: string;
  comments: Comment[];
  blockCommentCount: Record<string, number>;
  selectedBlock: { hash: string; text: string } | null;
  onClearSelection: () => void;
  open: boolean;
  onClose: () => void;
  focusCommentIds?: string[] | null;
}

function Avatar({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0', color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function AvatarSm({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0', color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function CommentPanel({
  documentId,
  comments,
  selectedBlock,
  onClearSelection,
  open,
  onClose,
  focusCommentIds,
}: CommentPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBlock && open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedBlock, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [focusCommentIds]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedBlock?.hash]);

  useEffect(() => {
    setReplyTo(null);
    setNewComment('');
  }, [selectedBlock]);

  const createMutation = useMutation({
    mutationFn: (content: string) => {
      if (!selectedBlock) throw new Error('No block selected');
      // 如果是回复某条评论，找到其根评论 id
      const rootId = replyTo
        ? (replyTo.root_id ?? replyTo.id) // 如果 replyTo 本身是回复，取其 root_id
        : undefined;
      const replyToUserId = replyTo?.user_id ?? undefined;
      return api.createComment(
        selectedBlock.hash,
        content,
        undefined,
        selectedBlock.text,
        rootId ?? undefined,
        replyToUserId ?? undefined,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] });
      setNewComment('');
      setReplyTo(null);
      onClearSelection();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] }),
  });

  const likeMutation = useMutation({
    mutationFn: (id: string) => api.likeComment(id),
    onMutate: async (id) => {
      // 乐观更新
      const queryKey = ['document-comments', documentId];
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<{ comments: Comment[]; blockCommentCount: Record<string, number> }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            comments: old.comments.map((c) =>
              c.id === id
                ? {
                    ...c,
                    liked_by_me: !c.liked_by_me,
                    like_count: (c.like_count ?? 0) + (c.liked_by_me ? -1 : 1),
                  }
                : c,
            ),
          };
        },
      );
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['document-comments', documentId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] });
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim() || !selectedBlock) return;
    createMutation.mutate(newComment.trim());
  };

  const canDelete = (comment: Comment) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return comment.user_id === user.id;
  };

  const toggleReplies = (rootId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  // 只取根评论做分组展示（root_id IS NULL），回复单独挂在根评论下
  const rootComments = comments.filter((c) => !c.root_id);
  const repliesByRoot: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (c.root_id) {
      if (!repliesByRoot[c.root_id]) repliesByRoot[c.root_id] = [];
      repliesByRoot[c.root_id].push(c);
    }
  }

  const renderReply = (reply: Comment) => (
    <div key={reply.id} className="flex gap-2 mt-2 pl-2 group/reply">
      <AvatarSm name={reply.username || '匿名'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-xs font-medium">{reply.username || '匿名用户'}</span>
          {reply.reply_to_username && (
            <span className="text-xs text-muted-foreground">
              → {reply.reply_to_username}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed break-words">{reply.content}</p>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => likeMutation.mutate(reply.id)}
            disabled={!user}
            className={cn(
              'flex items-center gap-1 text-xs transition-colors',
              reply.liked_by_me
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
              !user && 'cursor-default opacity-50',
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            {reply.like_count ? <span>{reply.like_count}</span> : <span>赞</span>}
          </button>
          <button
            onClick={() => {
              setReplyTo(reply);
              // 需要当前有 selectedBlock 才能发评论，这里提示用户先选文字
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            回复
          </button>
          {canDelete(reply) && (
            <button
              onClick={() => deleteMutation.mutate(reply.id)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/reply:opacity-100"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderRootComment = (comment: Comment, highlighted = false) => {
    const replies = repliesByRoot[comment.id] ?? [];
    const isExpanded = expandedReplies.has(comment.id);
    const replyCount = replies.length || comment.reply_count || 0;

    return (
      <div
        key={comment.id}
        className={cn(
          'px-4 py-3 transition-colors group',
          highlighted
            ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
            : 'hover:bg-muted/30',
        )}
      >
        <div className="flex gap-2.5">
          <Avatar name={comment.username || '匿名'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-medium truncate">{comment.username || '匿名用户'}</span>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(comment.created_at)}</span>
            </div>
            {comment.selected_text && (
              <div className="mb-1.5 pl-2 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground line-clamp-2">
                {comment.selected_text}
              </div>
            )}
            <p className="text-sm text-foreground leading-relaxed break-words">{comment.content}</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => likeMutation.mutate(comment.id)}
                disabled={!user}
                className={cn(
                  'flex items-center gap-1 text-xs transition-colors',
                  comment.liked_by_me
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                  !user && 'cursor-default opacity-50',
                )}
              >
                <ThumbsUp className="h-3 w-3" />
                {comment.like_count ? <span>{comment.like_count}</span> : <span>赞</span>}
              </button>
              <button
                onClick={() => {
                  setReplyTo(comment);
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                回复
              </button>
              {canDelete(comment) && (
                <button
                  onClick={() => deleteMutation.mutate(comment.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  删除
                </button>
              )}
            </div>

            {/* 展开/折叠回复 */}
            {replyCount > 0 && (
              <button
                onClick={() => toggleReplies(comment.id)}
                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {isExpanded ? '收起回复' : `查看 ${replyCount} 条回复`}
              </button>
            )}
            {isExpanded && replies.length > 0 && (
              <div className="mt-2 pl-2 border-l border-muted space-y-1">
                {replies.map(renderReply)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
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
                  ? `${rootComments.filter((c) => c.block_hash === selectedBlock.hash).length} 条`
                  : `${rootComments.length} 条`}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 overflow-y-auto py-2" ref={listRef}>
          {(() => {
            const focusSet = focusCommentIds ? new Set(focusCommentIds) : null;

            // 计算要显示的根评论列表
            let displayRoots: Comment[];
            if (focusSet) {
              // 气泡点击：只显示命中行的根评论（或回复所在的根评论）
              displayRoots = rootComments.filter((c) => {
                if (focusSet.has(c.id)) return true;
                const replies = repliesByRoot[c.id] ?? [];
                return replies.some((r) => focusSet.has(r.id));
              });
            } else if (selectedBlock) {
              displayRoots = rootComments.filter((c) => c.block_hash === selectedBlock.hash);
            } else {
              displayRoots = rootComments;
            }

            const isFocused = !!focusCommentIds || !!selectedBlock;

            if (rootComments.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <p className="text-sm">还没有评论</p>
                  <p className="text-xs opacity-60">选中文字后点击「评论」</p>
                </div>
              );
            }

            if (isFocused && displayRoots.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <MessageSquare className="h-6 w-6 opacity-30" />
                  <p className="text-sm">此段暂无评论</p>
                </div>
              );
            }

            return (
              <div className="divide-y">
                {isFocused && (
                  <div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20">
                    <span className="text-xs font-medium text-orange-600">
                      此段评论 {displayRoots.length} 条
                    </span>
                  </div>
                )}
                {displayRoots.map((c) => renderRootComment(c, isFocused))}
              </div>
            );
          })()}
        </div>

        {/* 底部输入区 */}
        <div className="border-t bg-white dark:bg-zinc-900 px-4 py-3 space-y-2">
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
          {replyTo && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs text-blue-600">
              <span className="flex-1 truncate">
                回复 {replyTo.username || '匿名用户'}：{replyTo.content.slice(0, 30)}
              </span>
              <button onClick={() => setReplyTo(null)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {!user && (
            <p className="text-xs text-center text-muted-foreground py-1">请登录后发表评论</p>
          )}
          {user && (
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
          )}
        </div>
      </div>
    </>
  );
}
