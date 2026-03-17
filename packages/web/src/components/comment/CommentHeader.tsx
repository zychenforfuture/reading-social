import { X, MessageSquare, Flame, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CommentHeaderProps {
  commentCount: number;
  sortMode: 'hot' | 'newest';
  onSortChange: (mode: 'hot' | 'newest') => void;
  onClose: () => void;
  inline?: boolean;
}

export default function CommentHeader({
  commentCount,
  sortMode,
  onSortChange,
  onClose,
  inline,
}: CommentHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">评论</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {commentCount} 条
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* 排序切换：最热 / 最新 */}
        {!inline && (
          <div className="flex items-center rounded-md border text-xs overflow-hidden mr-1">
            <button
              onClick={() => onSortChange('hot')}
              className={cn('flex items-center gap-0.5 px-2 py-1 transition-colors', sortMode === 'hot' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted')}
            >
              <Flame className="h-3 w-3" />
              最热
            </button>
            <button
              onClick={() => onSortChange('newest')}
              className={cn('flex items-center gap-0.5 px-2 py-1 transition-colors', sortMode === 'newest' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted')}
            >
              <Clock className="h-3 w-3" />
              最新
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}