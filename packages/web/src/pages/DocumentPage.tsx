import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, MessageSquare } from 'lucide-react';
import { api, type ContentBlock, type Comment, timeAgo, cn } from '../lib/utils';
import Editor from '../components/Editor';
import CommentPanel from '../components/CommentPanel';
import TableOfContents, { type Chapter } from '../components/TableOfContents';

// 章节标题检测正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+)/i;

/** 从 blocks 中提取章节结构 */
function buildChapters(blocks: ContentBlock[], blockCommentCount: Record<string, number>): Chapter[] {
  if (blocks.length === 0) return [];

  // 找到所有章节标题块的索引
  const headingIndexes: number[] = [];
  blocks.forEach((b, i) => {
    const firstLine = b.raw_content.split('\n')[0]?.trim() ?? '';
    if (CHAPTER_RE.test(firstLine) || (firstLine.length <= 40 && firstLine.length > 0 && i > 0)) {
      // 额外条件：短行且非首块也视为标题候选，但只保留匹配正则的
      if (CHAPTER_RE.test(firstLine)) headingIndexes.push(i);
    }
  });

  // 如果检测到至少 2 个章节标题，按标题切分
  if (headingIndexes.length >= 2) {
    return headingIndexes.map((start, idx) => {
      const end = headingIndexes[idx + 1] ?? blocks.length;
      const title = blocks[start]!.raw_content.split('\n')[0]!.trim();
      const chBlocks = blocks.slice(start, end);
      const commentCount = chBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
      return { index: idx, title, blockStart: start, blockCount: end - start, commentCount };
    });
  }

  // 否则按每 20 块自动分章
  const BLOCKS_PER_CHAPTER = 20;
  const chapters: Chapter[] = [];
  let i = 0;
  while (i < blocks.length) {
    const start = i;
    const end = Math.min(i + BLOCKS_PER_CHAPTER, blocks.length);
    const chBlocks = blocks.slice(start, end);
    const commentCount = chBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
    chapters.push({
      index: chapters.length,
      title: `第 ${chapters.length + 1} 章（第 ${start + 1}–${end} 段）`,
      blockStart: start,
      blockCount: end - start,
      commentCount,
    });
    i = end;
  }
  return chapters;
}

// -------- 本章评论区（页面底部内联展示）--------
interface ChapterCommentsProps {
  chapterBlocks: ContentBlock[];
  comments: Comment[];
  onSelectBlock: (hash: string, text: string) => void;
  onHoverBlock?: (hash: string) => void;
  onLeaveBlock?: () => void;
  highlightedBlockHash?: string | null;
}

function ChapterComments({ chapterBlocks, comments, onSelectBlock, onHoverBlock, onLeaveBlock, highlightedBlockHash }: ChapterCommentsProps) {
  const blockHashSet = new Set(chapterBlocks.map(b => b.block_hash));
  const chapterComments = comments.filter(c => blockHashSet.has(c.block_hash));
  if (chapterComments.length === 0) return null;

  // 按 block 顺序分组
  const groups: { block: ContentBlock; comments: Comment[] }[] = [];
  for (const block of chapterBlocks) {
    const bc = chapterComments.filter(c => c.block_hash === block.block_hash);
    if (bc.length > 0) groups.push({ block, comments: bc });
  }

  return (
    <div className="mt-6 border rounded-lg bg-card">
      <div className="border-b px-4 py-2.5 bg-muted/50 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">本章评论</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {chapterComments.length} 条
        </span>
      </div>
      <div className="divide-y">
        {groups.map(({ block, comments: gc }) => {
          const excerpt = block.raw_content.split('\n')[0]?.trim().slice(0, 80) ?? '';

          // 按 selected_text 二级分组，保持首次出现顺序
          const textGroupMap = new Map<string, Comment[]>();
          for (const c of gc) {
            const key = c.selected_text?.trim() ?? '';
            const arr = textGroupMap.get(key);
            if (arr) arr.push(c);
            else textGroupMap.set(key, [c]);
          }

          return (
            <div
              key={block.block_hash}
              className={cn(
                'px-4 py-3 transition-colors duration-200',
                block.block_hash === highlightedBlockHash
                  ? 'bg-orange-50 dark:bg-orange-900/20'
                  : '',
              )}
              onMouseEnter={() => onHoverBlock?.(block.block_hash)}
              onMouseLeave={() => onLeaveBlock?.()}
            >
              {/* 段落摘要（可点击） */}
              <button
                onClick={() => onSelectBlock(block.block_hash, excerpt)}
                className="w-full text-left mb-3 pl-2 border-l-2 border-orange-300 text-xs text-muted-foreground hover:text-foreground transition-colors line-clamp-1"
              >
                {excerpt}
                {block.raw_content.trim().length > 80 && '…'}
              </button>

              {/* 按引用文字分组 */}
              <div className="space-y-3">
                {Array.from(textGroupMap.entries()).map(([key, groupComments]) => (
                  <div key={key || '__no_text__'}>
                    {/* 共享引用文字：只显示一次 */}
                    {key && (
                      <div className="mb-2 pl-2 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground line-clamp-2">
                        {key}
                      </div>
                    )}
                    {/* 该引用下的所有评论 */}
                    <div className="space-y-2">
                      {groupComments.map(c => (
                        <div key={c.id} className="flex gap-2 items-start">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0',
                              ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-rose-500', 'bg-teal-500'][
                                (c.username?.charCodeAt(0) ?? 0) % 6
                              ],
                            )}
                          >
                            {(c.username ?? '匿').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 mb-0.5">
                              <span className="text-xs font-medium">{c.username ?? '匿名用户'}</span>
                              <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-sm leading-relaxed break-words">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedBlock, setSelectedBlock] = useState<{ hash: string; text: string } | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showTOC, setShowTOC] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [focusCommentIds, setFocusCommentIds] = useState<string[] | null>(null);
  const [highlightedBlockHash, setHighlightedBlockHash] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

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
      // 读取 token，额外用 query param 传递（EventSource 不支持设置 Header）
      let token = '';
      try {
        const stored = localStorage.getItem('collab-auth');
        if (stored) token = JSON.parse(stored)?.state?.token ?? '';
      } catch {}

      const url = `/api/comments/stream/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);

      es.onmessage = () => {
        // 收到新评论事件，触发评论数据刷新
        queryClient.invalidateQueries({ queryKey: ['document-comments', id] });
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

  const allBlocks = data?.content ?? [];
  const blockCommentCount = commentsData?.blockCommentCount ?? {};

  const chapters = useMemo(
    () => buildChapters(allBlocks, blockCommentCount),
    [allBlocks, blockCommentCount],
  );

  const chapter = chapters[currentChapter];
  const chapterBlocks = chapter
    ? allBlocks.slice(chapter.blockStart, chapter.blockStart + chapter.blockCount)
    : allBlocks;

  const goTo = (idx: number) => {
    setCurrentChapter(Math.max(0, Math.min(chapters.length - 1, idx)));
    setSelectedBlock(null);
    setShowComments(false);
    setHighlightedBlockHash(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold truncate flex-1 pr-4">{data.document.title}</h1>
        <div className="flex items-center gap-3 shrink-0">
          {chapters.length > 1 && (
            <button
              onClick={() => setShowTOC(true)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="h-4 w-4" />
              目录
            </button>
          )}
          <button
            onClick={() => setShowComments(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground relative"
          >
            <MessageSquare className="h-4 w-4" />
            评论
            {chapterCommentCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {chapterCommentCount > 99 ? '99+' : chapterCommentCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 章节导航栏 */}
      {chapters.length > 1 && (
        <div className="flex items-center justify-between border rounded-lg px-4 py-2 bg-muted/30 text-sm">
          <button
            onClick={() => goTo(currentChapter - 1)}
            disabled={currentChapter === 0}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
            上一章
          </button>

          <button
            onClick={() => setShowTOC(true)}
            className="flex-1 text-center font-medium text-foreground px-4 hover:text-primary transition-colors truncate"
          >
            {chapter?.title ?? ''}
            <span className="text-xs text-muted-foreground font-normal ml-2">
              {currentChapter + 1} / {chapters.length}
            </span>
          </button>

          <button
            onClick={() => goTo(currentChapter + 1)}
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
        content={chapterBlocks}
        blockCommentCount={blockCommentCount}
        comments={commentsData?.comments ?? []}
        highlightedBlockHash={highlightedBlockHash}
        onSelectBlock={(hash, text) => {
          setHighlightedBlockHash(null);
          setSelectedBlock({ hash, text });
          setFocusCommentIds(null);
          setShowComments(true);
        }}
        onClickCommentBubble={(ids) => {
          setFocusCommentIds(ids);
          setSelectedBlock(null);
          setShowComments(true);
        }}
      />

      {/* 评论抽屉 */}
      <CommentPanel
        documentId={id!}
        comments={commentsData?.comments ?? []}
        blockCommentCount={blockCommentCount}
        selectedBlock={selectedBlock}
        onClearSelection={() => setSelectedBlock(null)}
        open={showComments}
        onClose={() => { setShowComments(false); setSelectedBlock(null); setFocusCommentIds(null); }}
        focusCommentIds={focusCommentIds}
      />

      {/* 本章全部评论 */}
      <ChapterComments
        chapterBlocks={chapterBlocks}
        comments={commentsData?.comments ?? []}
        highlightedBlockHash={highlightedBlockHash}
        onSelectBlock={(hash, text) => {
          setHighlightedBlockHash(hash);
          setSelectedBlock({ hash, text });
          setFocusCommentIds(null);
          setShowComments(true);
        }}
        onHoverBlock={(hash) => setHighlightedBlockHash(hash)}
        onLeaveBlock={() => setHighlightedBlockHash(null)}
      />

      {/* 底部翻章按钮 */}
      {chapters.length > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={() => goTo(currentChapter - 1)}
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
            onClick={() => goTo(currentChapter + 1)}
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
      )}

      {/* 目录抽屉 */}
      {showTOC && (
        <TableOfContents
          chapters={chapters}
          currentChapter={currentChapter}
          onSelect={goTo}
          onClose={() => setShowTOC(false)}
        />
      )}
    </div>
  );
}
