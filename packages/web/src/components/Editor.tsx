import { useRef, useMemo, useState, useLayoutEffect, forwardRef, useImperativeHandle, type CSSProperties } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { type ContentBlock, type Comment } from '../lib/utils';

export interface ReadingStyle {
  fontSize: number;    // px, e.g. 17
  lineHeight: number;  // e.g. 2.0
  bgColor: string;     // e.g. '#ffffff'
  textColor: string;   // e.g. '#1a1a1a'
}

interface EditorProps {
  content: ContentBlock[];
  blockCommentCount: Record<string, number>;
  comments: Comment[];
  onSelectBlock: (blockHash: string, selectedText: string) => void;
  onClickCommentBubble: (commentIds: string[], block: { hash: string; text: string }) => void;
  readingStyle?: ReadingStyle;
}

export interface EditorRef {
  scrollToBlock: (hash: string) => void;
}

// 章节标题识别正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇部]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+|序章|终章|后记|前言|楔子|尾声)/i;
// 短标题行（≤25字且不含标点密集内容）
const isHeadingLine = (line: string) => {
  const t = line.trim();
  return t.length > 0 && (CHAPTER_RE.test(t) || (t.length <= 25 && !/[，。！？；：""''、]{2,}/.test(t) && /^[\u4e00-\u9fa5a-zA-Z0-9\s·《》【】（）\-—]+$/.test(t)));
};

export default forwardRef<EditorRef, EditorProps>(function Editor(
  { content, blockCommentCount, comments, onSelectBlock, onClickCommentBubble, readingStyle },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      setScrollMargin(containerRef.current?.offsetTop ?? 0);
    };
    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);
    return () => window.removeEventListener('resize', updateScrollMargin);
  }, []);

  const commentsByBlockHash = useMemo(() => {
    const grouped: Record<string, Comment[]> = {};
    for (const comment of comments) {
      (grouped[comment.block_hash] ??= []).push(comment);
    }
    return grouped;
  }, [comments]);

  const virtualizer = useWindowVirtualizer({
    count: content.length,
    estimateSize: () => 100,
    overscan: 10,
    scrollMargin,
  });

  useImperativeHandle(ref, () => ({
    scrollToBlock: (hash: string) => {
      const index = content.findIndex(b => b.block_hash === hash);
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }));

  const fontSize = readingStyle?.fontSize ?? 17;
  const lineHeight = readingStyle?.lineHeight ?? 2.0;
  const bgColor = readingStyle?.bgColor ?? '#ffffff';
  const textColor = readingStyle?.textColor ?? '#1a1a1a';

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl shadow-sm transition-colors duration-300"
      style={{
        '--reading-bg': bgColor,
        '--reading-color': textColor,
        '--reading-font-size': `${fontSize}px`,
        '--reading-line-height': `${lineHeight}`,
        backgroundColor: 'var(--reading-bg)',
        color: 'var(--reading-color)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans CN", sans-serif',
      } as CSSProperties}
    >
      {/* 顶部提示 */}
      <div className="flex justify-end px-8 pt-5 pb-0">
        <span className="text-xs text-gray-300 select-none">点击句子可发表评论</span>
      </div>

      {/* 正文渲染区 - Virtual List */}
      <div
        className="select-text"
        style={{ padding: '2rem 3.5rem 4rem' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const blockIdx = virtualItem.index;
            const block = content[blockIdx];
            const totalCount = blockCommentCount[block.block_hash] ?? 0;
            const blockComments = commentsByBlockHash[block.block_hash] ?? [];
            const lines = block.raw_content.split('\n').filter((l: string) => l.trim() !== '' || block.raw_content.trim() === '');

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                }}
              >
                {(() => {
                  // 空白块作分隔
                  if (block.raw_content.trim() === '') {
                    return <div data-block-hash={block.block_hash} style={{ height: '1.2em' }} />;
                  }

                  const lineCommentIds: string[][] = lines.map(() => []);
                  for (const c of blockComments) {
                    let placed = false;
                    if (c.selected_text) {
                      const probe = c.selected_text.trim().substring(0, 20);
                      const idx = lines.findIndex((l: string) => l.includes(probe));
                      if (idx >= 0) { lineCommentIds[idx].push(c.id); placed = true; }
                    }
                    if (!placed) lineCommentIds[lines.length - 1].push(c.id);
                  }

                  const firstLine = lines[0]?.trim() ?? '';
                  const isSingleHeading = lines.length === 1 && isHeadingLine(firstLine);
                  const isChapterHeading = block.type === 'heading' || CHAPTER_RE.test(firstLine);

                  if (isSingleHeading) {
                    return (
                      <div
                        data-block-hash={block.block_hash}
                        className={[
                          'transition-colors duration-300',
                          isChapterHeading ? 'mt-10 mb-6' : 'mt-6 mb-4',
                          totalCount > 0 ? 'rounded' : '',
                        ].join(' ')}
                      >
                        <p
                          className={[
                            'text-center font-bold break-words cursor-pointer rounded transition-colors hover:bg-orange-50',
                            isChapterHeading ? 'text-xl tracking-widest' : 'text-base tracking-wide',
                            totalCount > 0 ? 'bg-amber-50 px-2' : '',
                          ].join(' ')}
                          style={{
                            lineHeight: `calc(var(--reading-line-height) + 0.2)`,
                            color: 'var(--reading-color)'
                          }}
                          onClick={() => {
                            if (window.getSelection()?.toString().trim()) return;
                            onSelectBlock(block.block_hash, firstLine);
                          }}
                        >
                          {firstLine}
                          {lineCommentIds[0]?.length > 0 && (
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => { e.stopPropagation(); onClickCommentBubble(lineCommentIds[0], { hash: block.block_hash, text: firstLine }); }}
                              className="inline-flex items-center justify-center ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-400 hover:bg-orange-500 text-white text-[11px] font-bold leading-none align-middle transition-colors cursor-pointer select-none"
                            >
                              {lineCommentIds[0].length}
                            </button>
                          )}
                        </p>
                        {isChapterHeading && (
                          <div className="flex justify-center mt-3 mb-1">
                            <span className="block w-12 h-px bg-gray-200" />
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      data-block-hash={block.block_hash}
                      className={[
                        'transition-colors duration-300',
                        totalCount > 0 ? 'bg-amber-50/60 rounded-sm' : '',
                      ].join(' ')}
                    >
                      {lines.map((line: string, lineIdx: number) => {
                        const trimmed = line.trim();
                        const isDialogue = trimmed.startsWith('\u201c') || trimmed.startsWith('\u2018') || trimmed.startsWith('"') || trimmed.startsWith('\u300c');
                        return (
                          <p
                            key={lineIdx}
                            className="break-words cursor-pointer rounded transition-colors hover:bg-orange-50/60"
                            style={{
                              fontSize: 'var(--reading-font-size)',
                              lineHeight: 'var(--reading-line-height)',
                              textIndent: '2em',
                              marginBottom: isDialogue ? '0' : '0.1em',
                              letterSpacing: '0.02em',
                              color: 'var(--reading-color)',
                            }}
                            onClick={() => {
                              if (window.getSelection()?.toString().trim()) return;
                              onSelectBlock(block.block_hash, trimmed);
                            }}
                          >
                            {trimmed}
                            {lineCommentIds[lineIdx].length > 0 && (
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => { e.stopPropagation(); onClickCommentBubble(lineCommentIds[lineIdx], { hash: block.block_hash, text: trimmed }); }}
                                className="inline-flex items-center justify-center ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-400 hover:bg-orange-500 text-white text-[11px] font-bold leading-none align-middle transition-colors cursor-pointer select-none"
                                style={{ verticalAlign: 'middle' }}
                              >
                                {lineCommentIds[lineIdx].length}
                              </button>
                            )}
                          </p>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
