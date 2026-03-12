import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Chapter } from '../TableOfContents';

interface DocumentFooterProps {
  chapters: Chapter[];
  currentChapter: number;
  onGoToChapter: (idx: number) => void;
}

export default function DocumentFooter({
  chapters,
  currentChapter,
  onGoToChapter,
}: DocumentFooterProps) {
  if (chapters.length <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t">
      <button
        onClick={() => onGoToChapter(currentChapter - 1)}
        disabled={currentChapter === 0}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        上一章
        {currentChapter > 0 && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {chapters[currentChapter - 1]?.title}
          </span>
        )}
      </button>
      <button
        onClick={() => onGoToChapter(currentChapter + 1)}
        disabled={currentChapter === chapters.length - 1}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-30 transition-colors"
      >
        {currentChapter < chapters.length - 1 && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {chapters[currentChapter + 1]?.title}
          </span>
        )}
        下一章
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}