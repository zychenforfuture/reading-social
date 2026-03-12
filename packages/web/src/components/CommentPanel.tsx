import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn, timeAgo } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import { X, ThumbsUp, MessageSquare, Send, Flame, Clock } from 'lucide-react';
import { Avatar } from './comment/Avatar';
import ReplySection from './comment/ReplySection';

export { Avatar, ReplySection };

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
  /** 内联侧栏模式：吹附在正文右侧，无遮罩，sticky 定位 */
  inline?: boolean;
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
  inline,
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
      {/* 遮罩：仅非 inline 模式显示 */}
      {open && !inline && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}

      {/* 面板：inline 模式为 sticky 侧栏，普通模式为 fixed 左展抽屉 */}
      <div
        className={cn(
          inline
            ? 'sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col border-l bg-background overflow-hidden transition-[width] duration-300'
            : 'fixed top-0 right-0 h-full bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          inline
            ? (open ? 'w-[300px]' : 'w-0')
            : (open ? 'translate-x-0 w-80' : 'translate-x-full w-80'),
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
                    <ReplySection
                      comment={comment}
                      documentId={documentId}
                      currentUser={user}
                      onLikeRoot={() => likeMutation.mutate(comment.id)}
                      onDeleteRoot={() => {
                        if (window.confirm('确认删除这条评论？')) {
                          deleteMutation.mutate(comment.id);
                        }
                      }}
                      canDeleteRoot={Boolean(user?.is_admin || comment.user_id === user?.id)}
                    />
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
                            <ReplySection
                              comment={comment}
                              documentId={documentId}
                              currentUser={user}
                              onLikeRoot={() => likeMutation.mutate(comment.id)}
                              onDeleteRoot={() => {
                                if (window.confirm('确认删除这条评论？')) {
                                  deleteMutation.mutate(comment.id);
                                }
                              }}
                              canDeleteRoot={Boolean(user?.is_admin || comment.user_id === user?.id)}
                            />
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
              placeholder={selectedBlock ? '写下你的评论… (⌘Enter 发送)' : '点击正文句子开始评论'}
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