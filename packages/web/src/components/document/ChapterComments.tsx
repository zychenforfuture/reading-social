import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type ContentBlock, type Comment, cn, timeAgo } from '../../lib/utils';
import { useUserStore } from '../../stores/userStore';
import { Avatar, ReplySection } from '../CommentPanel';
import { MessageSquare } from 'lucide-react';

interface ChapterCommentsProps {
  documentId: string;
  chapterBlocks: ContentBlock[];
  comments: Comment[];
  onSelectBlock: (hash: string, text: string) => void;
}

export default function ChapterComments({ documentId, chapterBlocks, comments, onSelectBlock }: ChapterCommentsProps) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  type CommentsCache = { comments: Comment[]; blockCommentCount: Record<string, number> };

  // 点赞（乐观更新 + 快照回滚）
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
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['document-comments', documentId], context.previous);
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

  const blockHashSet = new Set(chapterBlocks.map(b => b.block_hash));
  const chapterComments = comments.filter(c => blockHashSet.has(c.block_hash));

  // 所有 hooks 已声明，现在才可以条件返回
  if (chapterComments.length === 0) return null;

  // 按「被评论的句子」一级分组，打平 block 层级
  // key: selected_text（有则用）；无 selected_text 时 fallback 到 block 首行
  const blockMap = new Map(chapterBlocks.map(b => [b.block_hash, b]));
  const blockOrder = new Map(chapterBlocks.map((b, i) => [b.block_hash, i]));

  type SentenceGroup = {
    mapKey: string;       // Map 去重 key（selected_text 或 '__block__'+hash）
    sentence: string;     // 展示用文字
    isFullBlock: boolean; // 无 selected_text 时为 true
    block: ContentBlock;
    comments: Comment[];
  };

  const sentenceMap = new Map<string, SentenceGroup>();
  for (const c of chapterComments) {
    const block = blockMap.get(c.block_hash)!;
    const st = c.selected_text?.trim() ?? '';
    const mapKey = st || `__block__${c.block_hash}`;
    if (!sentenceMap.has(mapKey)) {
      sentenceMap.set(mapKey, {
        mapKey,
        sentence: st || (block.raw_content.split('\n')[0]?.trim().slice(0, 80) ?? ''),
        isFullBlock: !st,
        block,
        comments: [],
      });
    }
    sentenceMap.get(mapKey)!.comments.push(c);
  }

  // 按 block 顺序排序，同一 block 内先句子评论后整段评论
  const sentenceGroups = Array.from(sentenceMap.values()).sort((a, b) => {
    const oi = blockOrder.get(a.block.block_hash) ?? 0;
    const oj = blockOrder.get(b.block.block_hash) ?? 0;
    if (oi !== oj) return oi - oj;
    if (a.isFullBlock !== b.isFullBlock) return a.isFullBlock ? 1 : -1;
    // 同一 block 内按句子在原文的出现位置排序
    const text = a.block.raw_content;
    const pa = text.indexOf(a.sentence.substring(0, 10));
    const pb = text.indexOf(b.sentence.substring(0, 10));
    return pa - pb;
  });

  return (
    <div className="mt-6 border rounded-lg bg-card">
      <div className="border-b px-4 py-2.5 bg-muted/50 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">本章评论</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {chapterComments.length} 条
        </span>
      </div>
      <div className="divide-y">
        {sentenceGroups.map(({ mapKey, sentence, isFullBlock, block, comments: gc }) => (
          <div key={mapKey} className="px-4 py-4">
            {/* 被评论句子引用 */}
            <button
              onClick={() => onSelectBlock(block.block_hash, isFullBlock ? '' : sentence)}
              className={[
                'w-full text-left mb-3 pl-3 border-l-2 text-xs transition-colors line-clamp-2',
                isFullBlock
                  ? 'border-gray-300 text-muted-foreground/70 hover:text-foreground italic'
                  : 'border-orange-400 text-gray-700 hover:text-foreground',
              ].join(' ')}
            >
              {sentence}{isFullBlock && sentence.length >= 80 && '…'}
            </button>

            {/* 该句子下的评论列表 */}
            <div className="space-y-3">
              {gc.map(c => (
                <div key={c.id} className="group">
                  <div className="flex gap-2.5">
                    <Avatar name={c.username || '匿名'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{c.username || '匿名用户'}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed break-words">{c.content}</p>
                      <ReplySection
                        comment={c}
                        documentId={documentId}
                        currentUser={user}
                        onLikeRoot={() => likeMutation.mutate(c.id)}
                        onDeleteRoot={() => {
                          if (window.confirm('确认删除这条评论？')) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                        canDeleteRoot={Boolean(user?.is_admin || c.user_id === user?.id)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

