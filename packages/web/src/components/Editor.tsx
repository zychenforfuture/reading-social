import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { type ContentBlock, type Comment } from '../lib/utils';

interface EditorProps {
  content: ContentBlock[];
  blockCommentCount: Record<string, number>;
  comments: Comment[];
  onSelectBlock: (blockHash: string, selectedText: string) => void;
  onClickCommentBubble: (commentIds: string[], block: { hash: string; text: string }) => void;
}

interface Tooltip {
  x: number;
  y: number;
  blockHash: string;
  text: string;
}

// 章节标题识别正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇部]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+|序章|终章|后记|前言|楔子|尾声)/i;
// 短标题行（≤25字且不含标点密集内容）
const isHeadingLine = (line: string) => {
  const t = line.trim();
  return t.length > 0 && (CHAPTER_RE.test(t) || (t.length <= 25 && !/[，。！？；：""''、]{2,}/.test(t) && /^[\u4e00-\u9fa5a-zA-Z0-9\s·《》【】（）\-—]+$/.test(t)));
};

export default function Editor({ content, blockCommentCount, comments, onSelectBlock, onClickCommentBubble }: EditorProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTooltip(null); }, [content]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTooltip(null);
      return;
    }
    const selectedText = selection.toString().trim();
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !containerRef.current) { setTooltip(null); return; }

    let node: Node | null = anchorNode;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    let el = node as Element | null;
    while (el && !el.hasAttribute('data-block-hash')) el = el.parentElement;
    if (!el || !containerRef.current.contains(el)) { setTooltip(null); return; }

    const blockHash = el.getAttribute('data-block-hash')!;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, blockHash, text: selectedText });
  }, []);

  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative bg-white rounded-2xl shadow-sm"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "Source Han Sans CN", sans-serif' }}
    >
      {/* 顶部提示 */}
      <div className="flex justify-end px-8 pt-5 pb-0">
        <span className="text-xs text-gray-300 select-none">选中文字可发表评论</span>
      </div>

      {/* 正文渲染区 */}
      <div
        className="min-h-[500px] select-text"
        style={{ padding: '2rem 3.5rem 4rem' }}
        onMouseUp={handleMouseUp}
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
                    'text-center font-bold text-gray-900 break-words',
                    isChapterHeading ? 'text-xl tracking-widest' : 'text-base tracking-wide',
                    totalCount > 0 ? 'bg-amber-50 px-2 rounded' : '',
                  ].join(' ')}
                  style={{ lineHeight: '2.2' }}
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
                    className="text-gray-800 break-words"
                    style={{
                      fontSize: '17px',
                      lineHeight: '2.0',
                      textIndent: '2em',
                      marginBottom: isDialogue ? '0' : '0.1em',
                      letterSpacing: '0.02em',
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

      {/* 浮动评论气泡 */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 50,
          }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-1.5 flex items-center gap-1.5"
        >
          <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectBlock(tooltip.blockHash, tooltip.text);
              setTooltip(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="text-sm font-medium text-orange-500 whitespace-nowrap hover:underline"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            评论选中文字
          </button>
          <span
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #e5e7eb',
            }}
          />
        </div>
      )}
    </div>
  );
}
