import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { api, type ContentBlock, type Comment, type Document as DocEntry } from '../lib/utils';
import CommentPanel from '../components/CommentPanel';
import TableOfContents from '../components/TableOfContents';
import ReadingSettings, { loadSettings } from '../components/document/ReadingSettings';
import DocumentHeader from '../components/document/DocumentHeader';
import DocumentContent from '../components/document/DocumentContent';
import DocumentFooter from '../components/document/DocumentFooter';
import { BG_THEMES } from '../components/document/ReadingSettings';
import { buildChapters } from '../utils/chapterUtils';

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedBlock, setSelectedBlock] = useState<{ hash: string; text: string } | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showTOC, setShowTOC] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [focusCommentIds, setFocusCommentIds] = useState<string[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const initSettings = loadSettings();
  const [fontSize, setFontSize] = useState(initSettings.fontSize);
  const [lineHeight, setLineHeight] = useState(initSettings.lineHeight);
  const [bgKey, setBgKey] = useState(initSettings.bgKey);
  const bgTheme = BG_THEMES.find(t => t.key === bgKey) ?? BG_THEMES[0]!;
  const readingStyle = { fontSize, lineHeight, bgColor: bgTheme.bgColor, textColor: bgTheme.textColor };
  // 记录文档切换时保存的章节索引，等章节列表建立后恢复
  const savedChapterRef = useRef(0);
  // 每篇文档只恢复一次，避免后续批量加载时反复跳转
  const restoredRef = useRef(false);
  // 刷新时恢复的滚动位置（null = 不恢复）
  const pendingScrollRef = useRef<number | null>(null);

  // 文档切换时读取上次阅读位置
  useEffect(() => {
    if (!id) return;
    setCurrentChapter(0);
    restoredRef.current = false;
    try {
      const saved = localStorage.getItem(`doc-chapter-${id}`);
      savedChapterRef.current = saved ? parseInt(saved, 10) : 0;
    } catch {
      savedChapterRef.current = 0;
    }
  }, [id]);

  // 滚动时实时保存位置（防抖 400ms）
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { localStorage.setItem(`doc-scroll-${id}`, String(Math.round(window.scrollY))); } catch {}
      }, 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
  }, [id]);

  // 分批加载所有块
  const [allBlocks, setAllBlocks] = useState<ContentBlock[]>([]);
  const [docMeta, setDocMeta] = useState<DocEntry | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  // 使用 ref 存储累积的 blocks，只在每批完成时更新状态
  const allBlocksRef = useRef<ContentBlock[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    allBlocksRef.current = [];
    setAllBlocks([]);
    setDocMeta(null);
    setLoadingBlocks(true);

    const BATCH = 5000;
    const loadAll = async () => {
      let offset = 0;
      let firstBatch = true;
      while (true) {
        if (cancelled) return;
        const res = await api.getDocument(id, offset, BATCH);
        if (cancelled) return;
        if (firstBatch) { setDocMeta(res.document); firstBatch = false; }
        // 累积到 ref，不触发重渲染
        allBlocksRef.current = allBlocksRef.current.concat(res.content);
        // 每批完成时更新一次状态
        setAllBlocks([...allBlocksRef.current]);
        if (!res.pagination.hasMore) break;
        offset += BATCH;
      }
      setLoadingBlocks(false);
    };

    loadAll().catch(() => { if (!cancelled) setLoadingBlocks(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // data shim 供下方代码复用
  const data = docMeta ? { document: docMeta, content: allBlocks } : null;
  const isLoading = loadingBlocks && allBlocks.length === 0;

  const { data: commentsData } = useQuery({
    queryKey: ['document-comments', id],
    queryFn: () => api.getDocumentComments(id!),
    enabled: !!id,
    // SSE 实时推送新评论，不再轮询
    staleTime: Infinity,
  });

  // SSE 实时推送：有新评论时刷新评论数据
  useEffect(() => {
    if (!id) return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    const MAX_RETRIES = 10;

    const connect = () => {
      // 读取 token，通过 Cookie 传递（EventSource 不支持设置 Header）
      // 后端支持：Cookie > Query Param，优先使用 Cookie
      let token = '';
      try {
        const stored = localStorage.getItem('collab-auth');
        if (stored) token = JSON.parse(stored)?.state?.token ?? '';
      } catch {}

      // 设置 Cookie（与后端 Cookie 认证兼容）
      if (token) {
        document.cookie = `auth_token=${token}; path=/api; SameSite=Lax`;
      }

      // 不再通过 query param 传递 token（避免日志记录），后端从 Cookie 读取
      const url = `/api/comments/stream/${id}`;
      es = new EventSource(url, { withCredentials: true });

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'like_updated') {
            // 点赞更新：直接修改缓存，不触发重新请求（保留 liked_by_me 状态）
            queryClient.setQueryData(
              ['document-comments', id],
              (old: { comments: Comment[]; blockCommentCount: Record<string, number> } | undefined) => {
                if (!old) return old;
                return {
                  ...old,
                  comments: old.comments.map((c: Comment) =>
                    c.id === data.commentId ? { ...c, like_count: data.likeCount } : c
                  ),
                };
              }
            );
          } else if (data.type === 'new_reply') {
            // 他人回复：根评论 reply_count +1
            queryClient.setQueryData(
              ['document-comments', id],
              (old: { comments: Comment[]; blockCommentCount: Record<string, number> } | undefined) => {
                if (!old) return old;
                return {
                  ...old,
                  comments: old.comments.map((c: Comment) =>
                    c.id === data.rootId ? { ...c, reply_count: c.reply_count + 1 } : c
                  ),
                };
              }
            );
            // 如果已展开该回复列表，追加新回复
            queryClient.setQueryData(
              ['replies', data.rootId],
              (old: { replies: Comment[] } | undefined) => {
                if (!old) return old;
                const exists = old.replies.some((r: Comment) => r.id === data.reply?.id);
                if (exists) return old;
                return { replies: [...old.replies, data.reply] };
              }
            );
          } else {
            // 新评论等其他事件：刷新评论列表
            queryClient.invalidateQueries({ queryKey: ['document-comments', id] });
          }
        } catch {
          queryClient.invalidateQueries({ queryKey: ['document-comments', id] });
        }
      };

      es.onopen = () => { retries = 0; };

      es.onerror = () => {
        es?.close();
        if (retries < MAX_RETRIES) {
          // 指数退避重连：1s, 2s, 4s … 最够 30s
          const delay = Math.min(1000 * 2 ** retries, 30000);
          retries++;
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [id, queryClient]);

  const blockCommentCount = commentsData?.blockCommentCount ?? {};

  const chapters = useMemo(
    () => buildChapters(allBlocks, blockCommentCount),
    [allBlocks, blockCommentCount],
  );

  // 从通知跳转：URL 中带有 ?block=xxx 时，自动定位到对应段落并打开评论
  const pendingBlockRef = useRef<string | null>(searchParams.get('block'));
  useEffect(() => {
    const blockHash = pendingBlockRef.current;
    if (!blockHash || allBlocks.length === 0 || chapters.length === 0) return;
    pendingBlockRef.current = null;
    // 清除 URL 中的 block 参数，避免刷新时重复触发
    setSearchParams(prev => { prev.delete('block'); return prev; }, { replace: true });
    // 找到该 block 属于哪个章节
    const blockIndex = allBlocks.findIndex(b => b.block_hash === blockHash);
    if (blockIndex === -1) return;
    const ch = chapters.find(c => blockIndex >= c.blockStart && blockIndex < c.blockStart + c.blockCount);
    const chapterIdx = ch ? chapters.indexOf(ch) : 0;
    // 切换到对应章节，选中该 block，打开评论抽屉
    setCurrentChapter(chapterIdx);
    setSelectedBlock({ hash: blockHash, text: allBlocks[blockIndex]!.raw_content.slice(0, 100) });
    setFocusCommentIds(null);
    setShowComments(true);
    // 切换章节后等 DOM 刷新再滚动
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-hash="${blockHash}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBlocks.length, chapters.length]);

  // 章节列表首次建立（或文档切换后重建）时，恢复上次阅读位置
  useEffect(() => {
    if (chapters.length === 0) { restoredRef.current = false; return; }
    if (restoredRef.current) return;
    restoredRef.current = true;
    const target = Math.max(0, Math.min(chapters.length - 1, savedChapterRef.current));
    if (target > 0) setCurrentChapter(target);
    // 读取上次滚动位置，等内容渲染后恢复
    try {
      const savedY = localStorage.getItem(`doc-scroll-${id}`);
      const y = savedY ? parseInt(savedY, 10) : 0;
      if (target > 0) {
        // chapter 会变化，由 useEffect([currentChapter]) 负责滚动
        pendingScrollRef.current = y;
      } else {
        // chapter 不变（已是 0），直接用 rAF 恢复
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
      }
    } catch {}
  }, [chapters.length]);

  const chapter = chapters[currentChapter];
  const chapterBlocks = chapter
    ? allBlocks.slice(chapter.blockStart, chapter.blockStart + chapter.blockCount)
    : allBlocks;

  // 章节内容切换后恢复滚动位置（刷新时）或回顶（手动翻章节时）
  useEffect(() => {
    if (pendingScrollRef.current === null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    // 双 rAF 确保 DOM 已完整渲染再滚动
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
  }, [currentChapter]);

  const goTo = (idx: number) => {
    const target = Math.max(0, Math.min(chapters.length - 1, idx));
    setCurrentChapter(target);
    setSelectedBlock(null);
    setShowComments(false);
    // 翻章节时清零滚动记录，确保到新章节顶部
    try { if (id) localStorage.removeItem(`doc-scroll-${id}`); } catch {}
    pendingScrollRef.current = 0; // 让 useEffect 滚到顶
    try { if (id) localStorage.setItem(`doc-chapter-${id}`, String(target)); } catch {}
  };

  const allComments = commentsData?.comments ?? [];
  const chapterBlockHashSet = new Set(chapterBlocks.map(b => b.block_hash));
  const chapterCommentCount = allComments.filter(c => chapterBlockHashSet.has(c.block_hash)).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20">加载中...</div>;
  }
  if (!data) {
    return <div className="text-center py-20 text-muted-foreground">文档不存在</div>;
  }

  return (
    <div className={cn(
      'transition-all duration-300',
      showComments
        ? 'mx-auto max-w-[1080px] flex items-start'
        : 'mx-auto max-w-[740px]',
    )}>
      {/* 阅读内容列 */}
      <div className={cn('min-w-0 space-y-4', showComments ? 'flex-1' : 'w-full')}>
        <DocumentHeader
          title={data.document.title}
          chapters={chapters}
          currentChapter={currentChapter}
          loadingBlocks={loadingBlocks}
          chapterCommentCount={chapterCommentCount}
          showSettings={showSettings}
          onShowTOC={() => setShowTOC(true)}
          onShowComments={() => {
            setShowComments(true);
            setSelectedBlock(null);
            setFocusCommentIds(null);
          }}
          onToggleSettings={() => setShowSettings(v => !v)}
        />

        <ReadingSettings
          fontSize={fontSize}
          setFontSize={setFontSize}
          lineHeight={lineHeight}
          setLineHeight={setLineHeight}
          bgKey={bgKey}
          setBgKey={setBgKey}
          showSettings={showSettings}
        />

        <DocumentContent
          chapterBlocks={chapterBlocks}
          blockCommentCount={blockCommentCount}
          comments={commentsData?.comments ?? []}
          readingStyle={readingStyle}
          chapters={chapters}
          currentChapter={currentChapter}
          loadingBlocks={loadingBlocks}
          onSelectBlock={(hash, text) => {
            setSelectedBlock({ hash, text });
            setFocusCommentIds(null);
            setShowComments(true);
          }}
          onClickCommentBubble={(ids, block) => {
            setFocusCommentIds(ids);
            setSelectedBlock({ hash: block.hash, text: block.text });
            setShowComments(true);
          }}
          onGoToChapter={goTo}
        />

        <DocumentFooter
          chapters={chapters}
          currentChapter={currentChapter}
          onGoToChapter={goTo}
        />

        {/* 目录抽屉 */}
        {showTOC && (
          <TableOfContents
            chapters={chapters}
            currentChapter={currentChapter}
            onSelect={goTo}
            onClose={() => setShowTOC(false)}
          />
        )}
      </div>{/* end reading content */}

      {/* 内联评论侧栏：同正文并排，sticky 吸附在右侧 */}
      {showComments && (
        <CommentPanel
          inline
          documentId={id!}
          comments={allComments.filter(c => chapterBlockHashSet.has(c.block_hash))}
          blockCommentCount={blockCommentCount}
          selectedBlock={selectedBlock}
          onClearSelection={() => setSelectedBlock(null)}
          open={showComments}
          onClose={() => { setShowComments(false); setSelectedBlock(null); setFocusCommentIds(null); }}
          focusCommentIds={focusCommentIds}
          onClearFocus={() => setFocusCommentIds(null)}
        />
      )}
    </div>
  );
}