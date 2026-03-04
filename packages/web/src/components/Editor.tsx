import { useRef } from 'react';
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

// 章节标题识别正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇部]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+|序章|终章|后记|前言|楔子|尾声)/i;
// 短标题行（≤25字且不含标点密集内容）
const isHeadingLine = (line: string) => {
  const t = line.trim();
  return t.length > 0 && (CHAPTER_RE.test(t) || (t.length <= 25 && !/[，。！？；：""''、]{2,}/.test(t) && /^[\u4e00-\u9fa5a-zA-Z0-9\s·《》【】（）\-—]+$/.test(t)));
};

export default function Editor({ content, blockCommentCount, comments, onSelectBlock, onClickCommentBubble, readingStyle }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const fontSize = readingStyle?.fontSize ?? 17;
  const lineHeight = readingStyle?.lineHeight ?? 2.0;
  const bgColor = readingStyle?.bgColor ?? '#ffffff';
  const textColor = readingStyle?.textColor ?? '#1a1a1a';

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl shadow-sm transition-colors duration-300"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans CN", sans-serif',
      }}
    >
      {/* 顶部提示 */}
      <div className="flex justify-end px-8 pt-5 pb-0">
        <span className="text-xs text-gray-300 select-none">点击句子可发表评论</span>
      </div>

      {/* 正文渲染区 */}
      <div
        className="min-h-[500px] select-text"
        style={{ padding: '2rem 3.5rem 4rem' }}
      >
        {content.map((block, blockIdx) => {
          const totalCount = blockCommentCount[block.block_hash] ?? 0;
          const blockComments = comments.filter(c => c.block_hash === block.block_hash);
          const lines = block.raw_content.split('\n').filter(l => l.trim() !== '' || block.raw_content.trim() === '');

          // 空白块作分隔
          if (block.raw_content.trim() === '') {
            return <div key={block.block_hash} style={{ height: '1.2em' }} />;
          }

          const lineCommentIds: string[][] = lines.map(() => []);
          for (const c of blockComments) {
            let placed = false;
            if (c.selected_text) {
              const probe = c.selected_text.trim().substring(0, 20);
              const idx = lines.findIndex(l => l.includes(probe));
              if (idx >= 0) { lineCommentIds[idx].push(c.id); placed = true; }
            }
            if (!placed) lineCommentIds[lines.length - 1].push(c.id);
          }

          // 判断整段是否为标题块：单行且符合标题规则，或首行匹配 CHAPTER_RE
          const firstLine = lines[0]?.trim() ?? '';
          const isSingleHeading = lines.length === 1 && isHeadingLine(firstLine);
          const isChapterHeading = CHAPTER_RE.test(firstLine);

          if (isSingleHeading) {
            return (
              <div
                key={block.block_hash}
                data-block-hash={block.block_hash}
                className={[
                  'transition-colors duration-300',
                  isChapterHeading ? 'mt-10 mb-6' : 'mt-6 mb-4',
                  totalCount > 0 ? 'rounded' : '',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-center font-bold text-gray-900 break-words cursor-pointer rounded transition-colors hover:bg-orange-50',
                    isChapterHeading ? 'text-xl tracking-widest' : 'text-base tracking-wide',
                    totalCount > 0 ? 'bg-amber-50 px-2' : '',
                  ].join(' ')}
                  style={{ lineHeight: `${lineHeight + 0.2}`, color: textColor }}
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
                {/* 章节标题下方分隔线 */}
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
              key={block.block_hash}
              data-block-hash={block.block_hash}
              className={[
                'transition-colors duration-300',
                totalCount > 0 ? 'bg-amber-50/60 rounded-sm' : '',
                blockIdx > 0 ? '' : '',
              ].join(' ')}
            >
              {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                // 对话行以 " " 开头
                const isDialogue = trimmed.startsWith('\u201c') || trimmed.startsWith('\u2018') || trimmed.startsWith('"') || trimmed.startsWith('\u300c');
                return (
                  <p
                    key={lineIdx}
                    className="break-words cursor-pointer rounded transition-colors hover:bg-orange-50/60"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: `${lineHeight}`,
                      textIndent: '2em',
                      marginBottom: isDialogue ? '0' : '0.1em',
                      letterSpacing: '0.02em',
                      color: textColor,
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
        })}
      </div>
    </div>
  );
}
