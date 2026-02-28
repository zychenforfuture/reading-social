import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Comment, cn } from '../lib/utils';
import { X, ThumbsUp, MessageSquare, Send } from 'lucide-react';

interface CommentPanelProps {
  documentId: string;
  comments: Comment[];
  blockCommentCount: Record<string, number>;
  selectedBlock: { hash: string; text: string } | null;
  onClearSelection: () => void;
  open: boolean;
  onClose: () => void;
  focusBlockHash?: string | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
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

export default function CommentPanel({
  documentId,
  comments,
  selectedBlock,
  onClearSelection,
  open,
  onClose,
  focusBlockHash,
}: CommentPanelProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showAll, setShowAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedBlock && open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [selectedBlock, open]);

  // 切换焦点段落时重置 showAll 并滚动到顶部
  useEffect(() => {
    setShowAll(false);
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [focusBlockHash]);

  // 选中新段落时清空回复状态
  useEffect(() => {
    setReplyTo(null);
    setNewComment('');
  }, [selectedBlock]);

  const createMutation = useMutation({
    mutationFn: (content: string) => {
      if (!selectedBlock) throw new Error('No block selected');
      return api.createComment(selectedBlock.hash, content, replyTo?.id, selectedBlock.text);
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
              {comments.length} 条
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 overflow-y-auto py-2" ref={listRef}>
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <p className="text-sm">还没有评论</p>
              <p className="text-xs opacity-60">选中文字后点击「评论」</p>
            </div>
          ) : (() => {
            const focusComments = focusBlockHash ? comments.filter(c => c.block_hash === focusBlockHash) : [];
            const otherComments = focusBlockHash ? comments.filter(c => c.block_hash !== focusBlockHash) : comments;
            const renderComment = (comment: Comment, highlighted = false) => (
              <div
                key={comment.id}
                className={cn(
                  'px-4 py-3 transition-colors group',
                  highlighted ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30' : 'hover:bg-muted/30',
                )}
              >
                <div className="flex gap-2.5">
                  <Avatar name={comment.username || '匿名'} />
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
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ThumbsUp className="h-3 w-3" />
                        <span>赞</span>
                      </button>
                      <button
                        onClick={() => { setReplyTo(comment); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        回复
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
            return (
              <div className="divide-y">
                {/* 焦点段落评论 置顶高亮 */}
                {focusComments.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20 flex items-center justify-between">
                      <span className="text-xs font-medium text-orange-600">此段评论 {focusComments.length} 条</span>
                      {otherComments.length > 0 && (
                        <button
                          onClick={() => setShowAll(v => !v)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {showAll ? '收起' : `查看全部 ${comments.length} 条`}
                        </button>
                      )}
                    </div>
                    {focusComments.map(c => renderComment(c, true))}
                    {otherComments.length > 0 && !showAll && (
                      <div className="px-4 py-2 text-center">
                        <button
                          onClick={() => setShowAll(true)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          查看全部 {comments.length} 条评论
                        </button>
                      </div>
                    )}
                    {showAll && otherComments.length > 0 && (
                      <>
                        <div className="px-4 py-1.5 bg-muted/40">
                          <span className="text-xs text-muted-foreground">其他评论</span>
                        </div>
                        {otherComments.map(c => renderComment(c, false))}
                      </>
                    )}
                  </>
                )}
                {/* 无焦点时显示全部 */}
                {focusComments.length === 0 && otherComments.map(c => renderComment(c, false))}
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
          {replyTo && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs text-blue-600">
              <span className="flex-1">回复 {replyTo.username || '匿名用户'}</span>
              <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
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

