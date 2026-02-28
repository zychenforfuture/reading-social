import { X, BookOpen } from 'lucide-react';

export interface Chapter {
  index: number;
  title: string;
  blockStart: number; // 在全部 blocks 中的起始索引
  blockCount: number;
  commentCount: number;
}

interface TableOfContentsProps {
  chapters: Chapter[];
  currentChapter: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function TableOfContents({
  chapters,
  currentChapter,
  onSelect,
  onClose,
}: TableOfContentsProps) {
  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    >
      {/* 抽屉面板 */}
      <div
        className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-zinc-900 border-r shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            目录
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {chapters.map((ch) => (
            <button
              key={ch.index}
              onClick={() => { onSelect(ch.index); onClose(); }}
              className={[
                'w-full text-left px-4 py-2.5 text-sm flex items-start gap-3 transition-colors hover:bg-muted/60',
                currentChapter === ch.index ? 'bg-primary/10 text-primary font-medium' : '',
              ].join(' ')}
            >
              <span className="text-xs text-muted-foreground mt-0.5 shrink-0 w-6 text-right">
                {ch.index + 1}
              </span>
              <span className="flex-1 leading-snug">{ch.title}</span>
              {ch.commentCount > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                  {ch.commentCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
