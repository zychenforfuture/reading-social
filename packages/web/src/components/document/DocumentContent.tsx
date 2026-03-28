import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContentBlock, Comment } from '../../lib/utils';
import Editor, { type ReadingStyle, type EditorRef } from '../Editor';
import ChapterComments from './ChapterComments';
import type { Chapter } from '../TableOfContents';

interface DocumentContentProps {
  chapterBlocks: ContentBlock[];
  blockCommentCount: Record<string, number>;
  comments: Comment[];
  readingStyle: ReadingStyle;
  chapters: Chapter[];
  currentChapter: number;
  loadingBlocks: boolean;
  onSelectBlock: (hash: string, text: string) => void;
  onClickCommentBubble: (ids: string[], block: { hash: string; text: string }) => void;
  onGoToChapter: (idx: number) => void;
}

export default forwardRef<EditorRef, DocumentContentProps>(function DocumentContent({
  chapterBlocks,
  blockCommentCount,
  comments,
  readingStyle,
  chapters,
  currentChapter,
  loadingBlocks,
  onSelectBlock,
  onClickCommentBubble,
  onGoToChapter,
}, ref) {
  const chapter = chapters[currentChapter];

  return (
    <>
      {/* 章节导航栏 */}
      {chapters.length > 1 && (
        <div className="sticky top-14 z-20 flex items-center justify-between border rounded-lg px-4 py-2 bg-background/95 backdrop-blur shadow-sm text-sm">
          <button
            onClick={() => onGoToChapter(currentChapter - 1)}
            disabled={currentChapter === 0}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
            上一章
          </button>

          <button
            onClick={() => onGoToChapter(currentChapter + 1)}
            className="flex-1 text-center font-medium text-foreground px-4 hover:text-primary transition-colors truncate"
          >
            {chapter?.title ?? ''}
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {currentChapter + 1} / {loadingBlocks ? '…' : chapters.length}
            </span>
          </button>

          <button
            onClick={() => onGoToChapter(currentChapter + 1)}
            disabled={currentChapter === chapters.length - 1}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity"
          >
            下一章
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 正文 */}
      <Editor
        ref={ref}
        content={chapterBlocks}
        blockCommentCount={blockCommentCount}
        comments={comments}
        readingStyle={readingStyle}
        onSelectBlock={onSelectBlock}
        onClickCommentBubble={onClickCommentBubble}
      />

      {/* 本章全部评论 */}
      <ChapterComments
        documentId=""
        chapterBlocks={chapterBlocks}
        comments={comments}
        onSelectBlock={onSelectBlock}
      />
    </>
  );
});