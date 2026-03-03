import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { MessageSquare } from 'lucide-react';
import type { ContentBlock, Comment } from '../lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// 基础显示缩放（CSS 像素），高清屏会在此基础上乘以 devicePixelRatio
const BASE_SCALE = 1.5;

interface PdfViewerProps {
  documentId: string;
  blocks: ContentBlock[];
  blockCommentCount: Record<string, number>;
  comments: Comment[];
  onSelectBlock: (hash: string, text: string) => void;
  onClickCommentBubble: (ids: string[]) => void;
}

export default function PdfViewer({
  documentId,
  blocks,
  blockCommentCount,
  comments,
  onSelectBlock,
  onClickCommentBubble,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  // 每页 CSS 显示尺寸，渲染后用于固定容器宽高
  const [pageSizes, setPageSizes] = useState<Map<number, { w: number; h: number }>>(new Map());
  // 每页的气泡位置：{ top: CSS坐标, hash, count }
  const [pageBubbles, setPageBubbles] = useState<Map<number, Array<{ top: number; hash: string; count: number }>>>(new Map());

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // 每页的 container div ref
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // 稳定 ref，供 useCallback 内正确读取最新值而不创建新引用
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const blockCommentCountRef = useRef(blockCommentCount);
  blockCommentCountRef.current = blockCommentCount;

  const pdfUrl = `/api/documents/${documentId}/pdf`;

  // 加载 PDF
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    setNumPages(0);
    setRenderedPages(new Set());
    setPageSizes(new Map());
    setPageBubbles(new Map());

    pdfjsLib.getDocument({ url: pdfUrl, cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`, cMapPacked: true })
      .promise
      .then((pdfDoc) => {
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('PDF load error:', err);
        setLoadError('PDF 加载失败，请稍后重试');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [pdfUrl]);

  // 从已渲染的 DOM 中重新计算气泡（不重绘 canvas）
  const computePageBubbles = useCallback((pageNum: number) => {
    const container = pageContainerRefs.current.get(pageNum);
    if (!container) return;
    const textLayerDiv = container.querySelector('.pdf-text-layer') as HTMLDivElement | null;
    if (!textLayerDiv) return;
    const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const allSpans = Array.from(textLayerDiv.querySelectorAll('span')) as HTMLSpanElement[];
    const bubbles: Array<{ top: number; hash: string; count: number }> = [];
    for (const block of blocksRef.current) {
      const count = blockCommentCountRef.current[block.block_hash] ?? 0;
      if (count === 0) continue;
      const blockNorm = norm(block.raw_content);
      if (!blockNorm) continue;
      let lastBottom = -1;
      for (const sp of allSpans) {
        const spText = norm(sp.textContent ?? '');
        if (spText.length < 2) continue;
        if (blockNorm.includes(spText)) {
          const t = parseFloat(sp.style.top || '0');
          const fh = parseFloat(sp.style.fontSize || '12');
          const bottom = t + fh;
          if (!isNaN(bottom) && bottom > lastBottom) lastBottom = bottom;
        }
      }
      if (lastBottom >= 0) bubbles.push({ top: lastBottom, hash: block.block_hash, count });
    }
    setPageBubbles((prev) => {
      const next = new Map(prev);
      next.set(pageNum, bubbles);
      return next;
    });
  }, []);

  // 渲染单页（canvas + text layer）——不依赖 blocks/blockCommentCount 避免重绘
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current) return;
    const container = pageContainerRefs.current.get(pageNum);
    if (!container) return;

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const textLayerDiv = container.querySelector('.pdf-text-layer') as HTMLDivElement;
    if (!canvas) return;

    const page = await pdfDocRef.current.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;

    // 显示用 viewport（CSS 像素）：供 text layer 定位坐标及 canvas CSS 尺寸
    const displayViewport = page.getViewport({ scale: BASE_SCALE });
    // 高清渲染 viewport（物理像素 = CSS像素 × DPR）
    const hiDpiViewport = page.getViewport({ scale: BASE_SCALE * dpr });

    // canvas 物理分辨率 = hiDpi，但 CSS 显示尺寸 = display
    canvas.width = hiDpiViewport.width;
    canvas.height = hiDpiViewport.height;
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport: hiDpiViewport }).promise;

    // 手动构建 text layer：不依赖 renderTextLayer API，兼容 pdfjs 3.x / 4.x
    if (textLayerDiv) {
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${displayViewport.width}px`;
      textLayerDiv.style.height = `${displayViewport.height}px`;

      const textContent = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const util = (pdfjsLib as any).Util;

      for (const item of textContent.items as Array<Record<string, unknown>>) {
        const str = item.str as string | undefined;
        if (!str) continue;

        // 用 viewport.transform 将 PDF 坐标转为 CSS 坐标
        const tx: number[] = util
          ? util.transform(displayViewport.transform, item.transform as number[])
          : (displayViewport as unknown as { transform: (t: number[]) => number[] }).transform(
              item.transform as number[],
            );

        const angle = Math.atan2(tx[1], tx[0]);
        const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const left = tx[4];
        const top = tx[5] - fontHeight;

        const span = document.createElement('span');
        span.textContent = str;
        span.style.cssText = [
          'position:absolute',
          `left:${left}px`,
          `top:${top}px`,
          `font-size:${fontHeight}px`,
          'font-family:sans-serif',
          'color:transparent',
          'white-space:pre',
          'cursor:text',
          'transform-origin:0% 0%',
          angle !== 0 ? `transform:rotate(${angle}rad)` : '',
        ]
          .filter(Boolean)
          .join(';');
        textLayerDiv.appendChild(span);
      }

      // 计算本页有评论的 block 的气泡位置（取 block 文本最后匹配 span 的底部 Y）
      const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      const bubbles: Array<{ top: number; hash: string; count: number }> = [];
      const allSpans = Array.from(textLayerDiv.querySelectorAll('span')) as HTMLSpanElement[];
      for (const block of blocks) {
        const count = blockCommentCount[block.block_hash] ?? 0;
        if (count === 0) continue;
        const blockNorm = norm(block.raw_content);
        if (!blockNorm) continue;
        let lastBottom = -1;
        for (const sp of allSpans) {
          const spText = norm(sp.textContent ?? '');
          if (spText.length < 2) continue;
          if (blockNorm.includes(spText)) {
            const t = parseFloat(sp.style.top || '0');
            const fh = parseFloat(sp.style.fontSize || '12');
            const bottom = t + fh;
            if (!isNaN(bottom) && bottom > lastBottom) lastBottom = bottom;
          }
        }
        if (lastBottom >= 0) bubbles.push({ top: lastBottom, hash: block.block_hash, count });
      }
      setPageBubbles((prev) => {
        const next = new Map(prev);
        next.set(pageNum, bubbles);
        return next;
      });
    }
    setPageSizes((prev) => {
      const next = new Map(prev);
      next.set(pageNum, { w: displayViewport.width, h: displayViewport.height });
      return next;
    });
    setRenderedPages((prev) => new Set(prev).add(pageNum));
  }, [computePageBubbles]);

  // renderPage 稳定（依赖 computePageBubbles），每次 numPages 就绪时渲染
  useEffect(() => {
    if (numPages === 0) return;
    const timer = setTimeout(() => {
      for (let i = 1; i <= numPages; i++) {
        renderPage(i);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [numPages, renderPage]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const query = norm(selectedText);

    // 先精确包含，再宽松前缀匹配
    const matched =
      blocks.find((b) => norm(b.raw_content).includes(query)) ||
      blocks.find((b) => {
        const content = norm(b.raw_content);
        return query.includes(content.slice(0, Math.min(30, content.length)));
      });

    if (matched) {
      onSelectBlock(matched.block_hash, selectedText);
      selection.removeAllRanges();
    }
  }, [blocks, onSelectBlock]);

  // blockCommentCount 变化时只重算气泡，不重绘 canvas
  useEffect(() => {
    if (renderedPages.size === 0) return;
    for (const pageNum of renderedPages) computePageBubbles(pageNum);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockCommentCount, computePageBubbles]);
  const totalComments = Object.values(blockCommentCount).reduce((a, b) => a + b, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">PDF 加载中…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-20 text-destructive text-sm">{loadError}</div>
    );
  }

  return (
    <div className="space-y-3" onMouseUp={handleMouseUp}>
      {/* 提示 */}
      <div className="text-xs text-muted-foreground text-center pb-1">
        共 {numPages} 页 · {blocks.length} 个文字块
        {totalComments > 0 && ` · ${totalComments} 条评论`}
        {' · '}划选文字可添加评论
      </div>

      {/* 水平居中；超宽时横向滚动 */}
      <div className="flex flex-col items-center gap-4 overflow-x-auto">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const size = pageSizes.get(pageNum);
          return (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageContainerRefs.current.set(pageNum, el);
                else pageContainerRefs.current.delete(pageNum);
              }}
              className="relative rounded-xl overflow-hidden shadow-sm border bg-white"
              style={{
                // 渲染完成前用占位高度；渲染完成后 canvas 自然撑开
                width: size ? size.w : undefined,
                minHeight: size ? undefined : 800,
                lineHeight: 0,
              }}
            >
              {/* 高清 Canvas */}
              <canvas />

              {/* Text layer：透明覆盖，坐标与 canvas 完全对齐 */}
              <div
                className="pdf-text-layer"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  overflow: 'hidden',
                  userSelect: 'text',
                  transformOrigin: '0 0',
                }}
              />

              {/* 评论气泡：绝对定位于段落末尾右侧 */}
              {(pageBubbles.get(pageNum) ?? []).map(({ top, hash, count }) => {
                const blockComments = comments.filter((c) => c.block_hash === hash);
                const ids = blockComments.map((c) => c.id);
                return (
                  <button
                    key={hash}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { e.stopPropagation(); onClickCommentBubble(ids); }}
                    style={{ position: 'absolute', top: top - 10, right: 6, zIndex: 10 }}
                    className="inline-flex items-center justify-center gap-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-orange-400 hover:bg-orange-500 text-white text-[11px] font-bold leading-none shadow transition-colors cursor-pointer select-none"
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    {count}
                  </button>
                );
              })}

              {/* 页码徽章 */}
              {renderedPages.has(pageNum) && (
                <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 rounded px-1.5 py-0.5 select-none pointer-events-none">
                  {pageNum} / {numPages}
                </div>
              )}

              {/* 渲染前占位 */}
              {!renderedPages.has(pageNum) && (
                <div
                  className="flex items-center justify-center bg-gray-50"
                  style={{ width: '100%', height: 800 }}
                >
                  <span className="text-xs text-muted-foreground">渲染中…</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
