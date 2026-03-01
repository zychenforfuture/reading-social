import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { type ContentBlock, type Comment } from '../lib/utils';

interface EditorProps {
  content: ContentBlock[];
  blockCommentCount: Record<string, number>;
  comments: Comment[];
  onSelectBlock: (blockHash: string, selectedText: string) => void;
  onClickCommentBubble: (commentIds: string[]) => void;
}

interface Tooltip {
  x: number;
  y: number;
  blockHash: string;
  text: string;
}

export default function Editor({ content, blockCommentCount, comments, onSelectBlock, onClickCommentBubble }: EditorProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 章节切换时清除 tooltip
  useEffect(() => {
    setTooltip(null);
  }, [content]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTooltip(null);
      return;
    }

    const selectedText = selection.toString().trim();
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !containerRef.current) {
      setTooltip(null);
      return;
    }

    // 找到最近的带有 data-block-hash 属性的祖先元素
    let node: Node | null = anchorNode;
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }
    let el = node as Element | null;
    while (el && !el.hasAttribute('data-block-hash')) {
      el = el.parentElement;
    }

    if (!el || !containerRef.current.contains(el)) {
      setTooltip(null);
      return;
    }

    const blockHash = el.getAttribute('data-block-hash')!;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      blockHash,
      text: selectedText,
    });
  }, []);

  // 滚动时隐藏 tooltip
  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, []);

  return (
    <div className="border rounded-lg bg-card" ref={containerRef}>
      <div className="border-b px-4 py-2 bg-muted/50">
        <span className="text-sm text-muted-foreground">
          <span className="text-xs opacity-60">选中文字可发表评论</span>
        </span>
      </div>

      {/* 正文渲染区 */}
      <div
        className="min-h-[500px] px-6 py-5 select-text"
        onMouseUp={handleMouseUp}
      >
        {content.map((block) => {
          const totalCount = blockCommentCount[block.block_hash] ?? 0;
          const blockComments = comments.filter(c => c.block_hash === block.block_hash);

          // 按 \n 拆成子段落
          const lines = block.raw_content.split('\n');

          // 按行收集评论 ID：selected_text 落在哪行，该评论 ID 就归到那行
          // 没有 selected_text 或找不到所在行的评论，归到最后一行
          const lineCommentIds: string[][] = lines.map(() => []);
          for (const c of blockComments) {
            let placed = false;
            if (c.selected_text) {
              const probe = c.selected_text.trim().substring(0, 20);
              const idx = lines.findIndex(l => l.includes(probe));
              if (idx >= 0) {
                lineCommentIds[idx].push(c.id);
                placed = true;
              }
            }
            if (!placed) {
              lineCommentIds[lines.length - 1].push(c.id);
            }
          }

          return (
            <div
              key={block.block_hash}
              data-block-hash={block.block_hash}
              className={[
              'mb-5 transition-colors duration-300',
              totalCount > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded px-1' : '',
            ].join(' ')}
            >
              {lines.map((line, lineIdx) => (
                <p
                  key={lineIdx}
                  className="leading-8 text-base text-foreground break-words"
                >
                  {line}
                  {lineCommentIds[lineIdx].length > 0 && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onClickCommentBubble(lineCommentIds[lineIdx]); }}
                      className="inline-flex items-center justify-center ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-400 hover:bg-orange-500 text-white text-[11px] font-bold leading-none align-middle transition-colors cursor-pointer select-none"
                      style={{ verticalAlign: 'middle' }}
                    >
                      {lineCommentIds[lineIdx].length}
                    </button>
                  )}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      {/* 浮动评论按钮 */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 50,
          }}
          className="bg-popover border rounded-md shadow-lg px-3 py-1.5 flex items-center gap-1.5"
        >
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectBlock(tooltip.blockHash, tooltip.text);
              setTooltip(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="text-sm font-medium text-primary whitespace-nowrap hover:underline"
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
              borderTop: '6px solid hsl(var(--border))',
            }}
          />
        </div>
      )}
    </div>
  );
}
