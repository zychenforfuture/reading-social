import { BookOpen, MessageSquare, SlidersHorizontal } from 'lucide-react';
import type { Chapter } from '../TableOfContents';

interface DocumentHeaderProps {
  title: string;
  chapters: Chapter[];
  currentChapter: number;
  loadingBlocks: boolean;
  chapterCommentCount: number;
  showSettings: boolean;
  onShowTOC: () => void;
  onShowComments: () => void;
  onToggleSettings: () => void;
}

export default function DocumentHeader({
  title,
  chapters,
  currentChapter: _currentChapter,
  loadingBlocks: _loadingBlocks,
  chapterCommentCount,
  showSettings,
  onShowTOC,
  onShowComments,
  onToggleSettings,
}: DocumentHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold truncate flex-1 pr-4">{title}</h1>
      <div className="flex items-center gap-3 shrink-0">
        {chapters.length > 1 && (
          <button
            onClick={onShowTOC}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            目录
          </button>
        )}
        <button
          onClick={onShowComments}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground relative"
        >
          <MessageSquare className="h-4 w-4" />
          评论
          {chapterCommentCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {chapterCommentCount > 99 ? '99+' : chapterCommentCount}
            </span>
          )}
        </button>
        <button
          onClick={onToggleSettings}
          className={`inline-flex items-center gap-1.5 text-sm transition-colors ${showSettings ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          设置
        </button>
      </div>
    </div>
  );
}