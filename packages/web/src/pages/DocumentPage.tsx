import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, MessageSquare, ThumbsUp } from 'lucide-react';
import { api, type ContentBlock, type Comment, type Document as DocEntry, timeAgo, cn } from '../lib/utils';
import Editor from '../components/Editor';
import CommentPanel, { Avatar, ReplySection } from '../components/CommentPanel';
import TableOfContents, { type Chapter } from '../components/TableOfContents';
import { useUserStore } from '../stores/userStore';

// 章节标题检测正则
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+)/i;

/** 从 blocks 中提取章节结构 */
function buildChapters(blocks: ContentBlock[], blockCommentCount: Record<string, number>): Chapter[] {
  if (blocks.length === 0) return [];

  // 找到所有章节标题块的索引
  const headingIndexes: number[] = [];
  blocks.forEach((b, i) => {
    const firstLine = b.raw_content.split('\n')[0]?.trim() ?? '';
    if (CHAPTER_RE.test(firstLine)) headingIndexes.push(i);
  });

  // 如果检测到至少 1 个章节标题，按标题切分
  if (headingIndexes.length >= 1) {
    const chapters: Chapter[] = [];

    // 第一章标题前若有内容，单独作为"前言"章节
    if (headingIndexes[0] > 0) {
      const preBlocks = blocks.slice(0, headingIndexes[0]);
      const commentCount = preBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
      chapters.push({ index: 0, title: '前言', blockStart: 0, blockCount: headingIndexes[0], commentCount });
    }

    headingIndexes.forEach((start, idx) => {
      const end = headingIndexes[idx + 1] ?? blocks.length;
      const title = blocks[start]!.raw_content.split('\n')[0]!.trim();
      const chBlocks = blocks.slice(start, end);
      const commentCount = chBlocks.reduce((s, b) => s + (blockCommentCount[b.block_hash] || 0), 0);
      chapters.push({ index: chapters.length, title, blockStart: start, blockCount: end - start, commentCount });
    });

    return chapters.map((c, i) => ({ ...c, index: i }));
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
  documentId: string;
  chapterBlocks: ContentBlock[];
  comments: Comment[];
  onSelectBlock: (hash: string, text: string) => void;
}

function ChapterComments({ documentId, chapterBlocks, comments, onSelectBlock }: ChapterCommentsProps) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  type CommentsCache = { comments: Comment[]; blockCommentCount: Record<string, number> };

  // 点赞（乐观更新 + 快照回滚）
  const likeMutation = useMutation({
    mutationFn: (commentId: string) => api.likeComment(commentId),
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['document-comments', documentId] });
      const previous = queryClient.getQueryData<CommentsCache>(['document-comments', documentId]);
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.id === commentId
              ? { ...c, liked_by_me: !c.liked_by_me, like_count: c.liked_by_me ? c.like_count - 1 : c.like_count + 1 }
              : c
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['document-comments', documentId], context.previous);
    },
    onSuccess: (data, commentId) => {
      queryClient.setQueryData<CommentsCache>(['document-comments', documentId], (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments.map((c) =>
            c.id === commentId ? { ...c, liked_by_me: data.liked, like_count: data.likeCount } : c
          ),
        };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-comments', documentId] }),
  });

  const blockHashSet = new Set(chapterBlocks.map(b => b.block_hash));
  const chapterComments = comments.filter(c => blockHashSet.has(c.block_hash));

  // 所有 hooks 已声明，现在才可以条件返回
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

          // 按 selected_text 二级分组
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
              className="px-4 py-3"
            >
              {/* 段落摘要（可点击） */}
              <button
                onClick={() => onSelectBlock(block.block_hash, excerpt)}
                className="w-full text-left mb-3 pl-2 border-l-2 border-orange-300 text-xs text-muted-foreground hover:text-foreground transition-colors line-clamp-1"
              >
                {excerpt}{block.raw_content.trim().length > 80 && '…'}
              </button>

              {/* 按引用文字分组 */}
              <div className="space-y-4">
                {Array.from(textGroupMap.entries()).map(([key, groupComments]) => (
                  <div key={key || '__no_text__'}>
                    {key && (
                      <div className="mb-2 pl-2 border-l-2 border-orange-200 text-xs text-muted-foreground/80 italic line-clamp-2">
                        {key}
                      </div>
                    )}
                    <div className="space-y-3">
                      {groupComments.map(c => (
                        <div key={c.id} className="group">
                          <div className="flex gap-2.5">
                            <Avatar name={c.username || '匿名'} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-sm font-medium truncate">{c.username || '匿名用户'}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(c.created_at)}</span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed break-words">{c.content}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={() => likeMutation.mutate(c.id)}
                                  className={cn(
                                    'flex items-center gap-1 text-xs transition-colors',
                                    c.liked_by_me ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground'
                                  )}
                                >
                                  <ThumbsUp className={cn('h-3 w-3', c.liked_by_me && 'fill-current')} />
                                  {c.like_count > 0 && <span>{c.like_count}</span>}
                                </button>
                                {(user?.is_admin || c.user_id === user?.id) && (
                                  <button
                                    onClick={() => deleteMutation.mutate(c.id)}
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                              <ReplySection comment={c} documentId={documentId} currentUser={user} />
                            </div>
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
  // 记录文档切换时保存的章节索引，等章节列表建立后恢复
  const savedChapterRef = useRef(0);
  // 每篇文档只恢复一次，避免后续批量加载时反复跳转
  const restoredRef = useRef(false);

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

  // 分批加载所有块
  const [allBlocks, setAllBlocks] = useState<ContentBlock[]>([]);
  const [docMeta, setDocMeta] = useState<DocEntry | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setAllBlocks([]);
    setDocMeta(null);
    setLoadingBlocks(true);

    const BATCH = 5000;
    const loadAll = async () => {
      let offset = 0;
      let accumulated: ContentBlock[] = [];
      let firstBatch = true;
      while (true) {
        const res = await api.getDocument(id, offset, BATCH);
        if (cancelled) return;
        if (firstBatch) { setDocMeta(res.document); firstBatch = false; }
        accumulated = accumulated.concat(res.content);
        setAllBlocks([...accumulated]);
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
      // 读取 token，额外用 query param 传递（EventSource 不支持设置 Header）
      let token = '';
      try {
        const stored = localStorage.getItem('collab-auth');
        if (stored) token = JSON.parse(stored)?.state?.token ?? '';
      } catch {}

      const url = `/api/comments/stream/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);

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

  // 章节列表首次建立（或文档切换后重建）时，恢复上次阅读位置
  useEffect(() => {
    if (chapters.length === 0) { restoredRef.current = false; return; }
    if (restoredRef.current) return;
    restoredRef.current = true;
    const target = Math.max(0, Math.min(chapters.length - 1, savedChapterRef.current));
    if (target > 0) {
      setCurrentChapter(target);
      window.scrollTo({ top: 0 });
    }
  }, [chapters.length]);

  const chapter = chapters[currentChapter];
  const chapterBlocks = chapter
    ? allBlocks.slice(chapter.blockStart, chapter.blockStart + chapter.blockCount)
    : allBlocks;

  const goTo = (idx: number) => {
    const target = Math.max(0, Math.min(chapters.length - 1, idx));
    setCurrentChapter(target);
    setSelectedBlock(null);
    setShowComments(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="space-y-4 pb-6">
      {/* 后台继续加载，不显示进度提示 */}
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
        <div className="sticky top-14 z-20 flex items-center justify-between border rounded-lg px-4 py-2 bg-background/95 backdrop-blur shadow-sm text-sm">
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
              {currentChapter + 1} / {loadingBlocks ? '…' : chapters.length}
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
        onSelectBlock={(hash, text) => {
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

      {/* 评论抽屉：只显示当前章节的评论 */}
      <CommentPanel
        documentId={id!}
        comments={allComments.filter(c => chapterBlockHashSet.has(c.block_hash))}
        blockCommentCount={blockCommentCount}
        selectedBlock={selectedBlock}
        onClearSelection={() => setSelectedBlock(null)}
        open={showComments}
        onClose={() => { setShowComments(false); setSelectedBlock(null); setFocusCommentIds(null); }}
        focusCommentIds={focusCommentIds}
      />

      {/* 本章全部评论 */}
      <ChapterComments
        documentId={id!}
        chapterBlocks={chapterBlocks}
        comments={commentsData?.comments ?? []}
        onSelectBlock={(hash, text) => {
          setSelectedBlock({ hash, text });
          setFocusCommentIds(null);
          setShowComments(true);
        }}
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
