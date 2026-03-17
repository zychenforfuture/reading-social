import { useRef, useEffect } from 'react';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { type Comment, cn, timeAgo } from '../../lib/utils';
import { Avatar } from './Avatar';
import ReplySection from './ReplySection';

interface CommentListProps {
  comments: Comment[];
  documentId: string;
  currentUser: { id: string; username?: string; is_admin?: boolean } | null;
  onLike: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isFocused?: boolean;
  displayComments: Comment[];
}

export default function CommentList({
  comments,
  documentId,
  currentUser,
  onLike,
  onDelete,
  isFocused = false,
  displayComments,
}: CommentListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [displayComments]);

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
            currentUser={currentUser}
            onLikeRoot={() => onLike(comment.id)}
            onDeleteRoot={() => {
              if (window.confirm('确认删除这条评论？')) {
                onDelete(comment.id);
              }
            }}
            canDeleteRoot={Boolean(currentUser?.is_admin || comment.user_id === currentUser?.id)}
          />
        </div>
      </div>
    </div>
  );

  const renderGrouped = () => {
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
                    currentUser={currentUser}
                    onLikeRoot={() => onLike(comment.id)}
                    onDeleteRoot={() => {
                      if (window.confirm('确认删除这条评论？')) {
                        onDelete(comment.id);
                      }
                    }}
                    canDeleteRoot={Boolean(currentUser?.is_admin || comment.user_id === currentUser?.id)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  if (displayComments.length === 0 && comments.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <MessageSquare className="h-6 w-6 opacity-30" />
        <p className="text-sm">此段暂无评论</p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <MessageSquare className="h-8 w-8 opacity-30" />
        <p className="text-sm">还没有评论</p>
        <p className="text-xs opacity-60">选中文字后点击「评论」</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2" ref={listRef}>
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
    </div>
  );
}