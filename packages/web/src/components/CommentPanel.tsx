import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn } from '../lib/utils';
import { useUserStore } from '../stores/userStore';
import CommentHeader from './comment/CommentHeader';
import CommentForm from './comment/CommentForm';
import CommentList from './comment/CommentList';
import ReplySection from './comment/ReplySection';

export { Avatar } from './comment/Avatar';
export { ReplySection };

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

  // 选中新段落时清空输入
  useEffect(() => {
    setNewComment('');
  }, [selectedBlock?.hash]);

  type CommentsCache = { comments: Comment[]; blockCommentCount: Record<string, number> };

  const createMutation = useMutation({
    mutationFn: (content: string) => {
      if (!selectedBlock) throw new Error('No block selected');
      return api.createComment(selectedBlock.hash, content, undefined, selectedBlock.text);
    },
    onSuccess: ({ comment }) => {
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        const newCount = { ...old.blockCommentCount, [comment.block_hash]: (old.blockCommentCount[comment.block_hash] ?? 0) + 1 };
        return { comments: [...old.comments, comment], blockCommentCount: newCount };
      });
      setNewComment('');
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

  // 三种过滤模式
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
  const commentCount = focusSet
    ? focusSet.size
    : selectedBlock
      ? baseComments.length
      : comments.length;

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
        <CommentHeader
          commentCount={commentCount}
          sortMode={sortMode}
          onSortChange={setSortMode}
          onClose={onClose}
          inline={inline}
        />

        {/* 评论列表 */}
        <CommentList
          comments={comments}
          documentId={documentId}
          currentUser={user}
          onLike={(commentId) => likeMutation.mutate(commentId)}
          onDelete={(commentId) => deleteMutation.mutate(commentId)}
          isFocused={isFocused}
          displayComments={displayComments}
        />

        {/* 底部输入区 */}
        <CommentForm
          selectedBlock={selectedBlock}
          value={newComment}
          onChange={setNewComment}
          onSubmit={() => {
            if (!newComment.trim() || !selectedBlock) return;
            createMutation.mutate(newComment.trim());
          }}
          isPending={createMutation.isPending}
        />
      </div>
    </>
  );
}