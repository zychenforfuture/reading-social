import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { ContentBlock } from '../lib/utils';

// 使用 CDN worker，避免 Vite worker 打包问题
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentId: string;
  blocks: ContentBlock[];
  blockCommentCount: Record<string, number>;
  onSelectBlock: (hash: string, text: string) => void;
  onClickCommentBubble: (ids: string[]) => void;
}

export default function PdfViewer({
  documentId,
  blocks,
  blockCommentCount,
  onSelectBlock,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  // 每页的 container div ref
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const pdfUrl = `/api/documents/${documentId}/pdf`;

  // 加载 PDF
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    setNumPages(0);
    setRenderedPages(new Set());

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

  // 渲染单页（canvas + text layer）
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current) return;
    const container = pageContainerRefs.current.get(pageNum);
    if (!container) return;

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const textLayerDiv = container.querySelector('.pdf-text-layer') as HTMLDivElement;
    if (!canvas) return;

    const page = await pdfDocRef.current.getPage(pageNum);
    const scale = Math.min(1.5, window.innerWidth > 900 ? 1.5 : window.innerWidth / 600);
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    // 文字层（用于文本选择）
    if (textLayerDiv) {
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      const textContent = await page.getTextContent();
      try {
        // pdfjs-dist 4.x API (renderTextLayer 未在类型定义中导出，用 any 绕过)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs = pdfjsLib as any;
        const renderTask = pdfjs.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        await (renderTask as { promise: Promise<void> }).promise;
      } catch {
        // fallback: pdfjs-dist 3.x API
        try {
          const renderTask2 = (pdfjsLib as unknown as {
            renderTextLayer: (o: object) => { promise: Promise<void> };
          }).renderTextLayer({ textContent, container: textLayerDiv, viewport });
          await renderTask2.promise;
        } catch {
          // 如果文字层失败，静默忽略，继续 canvas-only 模式
        }
      }
    }

    setRenderedPages((prev) => new Set(prev).add(pageNum));
  }, []);

  // 页面 DOM 就绪后渲染
  useEffect(() => {
    if (numPages === 0) return;
    const timer = setTimeout(() => {
      for (let i = 1; i <= numPages; i++) {
        renderPage(i);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [numPages, renderPage]);

  // 鼠标抬起：检测文字选择 → 匹配 block
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (selectedText.length < 4) return;

    // 在已加载的 blocks 中找包含选中文字的 block
    const matched = blocks.find((b) => {
      const content = b.raw_content.replace(/\s+/g, ' ').trim();
      const query = selectedText.replace(/\s+/g, ' ').trim();
      return content.includes(query) || query.includes(content.slice(0, Math.min(40, content.length)));
    });

    if (matched) {
      onSelectBlock(matched.block_hash, selectedText);
      selection.removeAllRanges();
    }
  }, [blocks, onSelectBlock]);

  // 总评论数（标题区用）
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

      {/* 每页 */}
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
        <div
          key={pageNum}
          ref={(el) => {
            if (el) pageContainerRefs.current.set(pageNum, el);
            else pageContainerRefs.current.delete(pageNum);
          }}
          className="relative rounded-xl overflow-hidden shadow-sm border bg-white"
          style={{ lineHeight: 0 }}
        >
          {/* Canvas（视觉层） */}
          <canvas className="block w-full" />

          {/* Text layer（透明，可选中文字） */}
          <div
            className="pdf-text-layer absolute inset-0 overflow-hidden"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transformOrigin: '0 0',
              userSelect: 'text',
            }}
          />

          {/* 页码 */}
          {renderedPages.has(pageNum) && (
            <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 rounded px-1.5 py-0.5 select-none pointer-events-none">
              {pageNum} / {numPages}
            </div>
          )}

          {/* 未渲染占位 */}
          {!renderedPages.has(pageNum) && (
            <div className="flex items-center justify-center bg-gray-50" style={{ height: 800 }}>
              <span className="text-xs text-muted-foreground">渲染中…</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
