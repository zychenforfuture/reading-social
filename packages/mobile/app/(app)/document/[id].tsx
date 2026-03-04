import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documents, comments } from '../../../lib/api';
import { useAuthStore } from '../../../lib/store';
import type { Block, Comment, CommentWithReplies } from '../../../lib/api';
import CommentItem from '../../../components/CommentItem';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 2000;

// ── 章节结构（与 web 端 DocumentPage.tsx 对齐）────────────────────────────
const CHAPTER_RE = /^(第\s*[零一二三四五六七八九十百千\d]+\s*[章节卷回篇]|Chapter\s+\d+|CHAPTER\s+\d+|Part\s+\d+|卷[零一二三四五六七八九十百千\d]+)/i;

interface Chapter {
  index: number;
  title: string;
  blockStart: number;
  blockCount: number;
}

function buildChapters(blocks: Block[]): Chapter[] {
  if (blocks.length === 0) return [];
  const headingIndexes: number[] = [];
  blocks.forEach((b, i) => {
    const firstLine = b.content.split('\n')[0]?.trim() ?? '';
    if (CHAPTER_RE.test(firstLine)) headingIndexes.push(i);
  });
  if (headingIndexes.length >= 1) {
    const chapters: Chapter[] = [];
    if (headingIndexes[0] > 0) {
      chapters.push({ index: 0, title: '前言', blockStart: 0, blockCount: headingIndexes[0] });
    }
    headingIndexes.forEach((start, idx) => {
      const end = headingIndexes[idx + 1] ?? blocks.length;
      const title = blocks[start]!.content.split('\n')[0]!.trim();
      chapters.push({ index: chapters.length, title, blockStart: start, blockCount: end - start });
    });
    return chapters.map((c, i) => ({ ...c, index: i }));
  }
  // 降级：每 20 块自动分章
  const chapters: Chapter[] = [];
  let i = 0;
  while (i < blocks.length) {
    const start = i;
    const end = Math.min(i + 20, blocks.length);
    chapters.push({ index: chapters.length, title: `第 ${chapters.length + 1} 部分`, blockStart: start, blockCount: end - start });
    i = end;
  }
  return chapters;
}

export default function DocumentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = id as string;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── 分页状态 ────────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [docMeta, setDocMeta] = useState<{ id: string; title: string } | null>(null);

  // ── UI 状态 ──────────────────────────────────────────────────────────────
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest' | 'hot'>('newest');
  const [showToc, setShowToc] = useState(false);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  // heading hash → ScrollView 内的 Y 偏移
  const headingOffsets = useRef<Record<string, number>>({});
  // 章节列表（由 blocks 派生，不对外武露）
  const chapters = useMemo(() => buildChapters(blocks), [blocks]);
  const currentChapter = chapters[currentChapterIdx] ?? null;

  // ── 首屏加载 ─────────────────────────────────────────────────────────────
  const { isLoading, error, data: firstPageData } = useQuery({
    queryKey: ['document', docId, 0],
    queryFn: () => documents.get(docId, 0, PAGE_SIZE),
    enabled: !!docId,
  });

  useEffect(() => {
    if (!firstPageData) return;
    const data = firstPageData as any;
    setDocMeta({ id: data.id, title: data.title });
    setBlocks(data.blocks ?? []);
    const pg = data.pagination;
    if (pg) {
      setHasMore(pg.hasMore);
      setOffset(pg.offset + pg.limit);
    } else {
      setHasMore(false);
    }
  }, [firstPageData]);

  // ── 追加下一页 ───────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await documents.get(docId, offset, PAGE_SIZE);
      setBlocks((prev) => [...prev, ...(data.blocks ?? [])]);
      const pg = (data as any).pagination;
      if (pg) {
        setHasMore(pg.hasMore);
        setOffset(pg.offset + pg.limit);
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      Alert.alert('加载失败', e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [docId, offset, hasMore, loadingMore]);

  // ── 评论数据 ─────────────────────────────────────────────────────────────
  const { data: blockCommentCount = {} } = useQuery<Record<string, number>>({
    queryKey: ['docCommentCount', docId],
    queryFn: () => documents.getBlockCommentCounts(docId),
    enabled: !!docId,
  });

  const { data: rawBlockComments = [] } = useQuery<CommentWithReplies[]>({
    queryKey: ['comments', selectedBlock?.hash],
    queryFn: () => comments.getByBlock(selectedBlock!.hash),
    enabled: !!selectedBlock,
  });

  // ── 评论排序 ──────────────────────────────────────────────────────────────
  const hotScore = (c: CommentWithReplies) => {
    const ageHours = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
    return (c.like_count ?? 0) / Math.pow(ageHours + 2, 1.5);
  };
  const blockComments = [...rawBlockComments].sort((a, b) => {
    if (commentSort === 'hot') return hotScore(b) - hotScore(a);
    if (commentSort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
  });

  // 切换段落时重置排序
  useEffect(() => {
    setCommentSort('newest');
    setReplyTo(null);
    setCommentText('');
  }, [selectedBlock?.hash]);

  const createMutation = useMutation({
    mutationFn: (body: { blockHash: string; content: string; rootId?: string }) =>
      comments.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', selectedBlock?.hash] });
      queryClient.invalidateQueries({ queryKey: ['docCommentCount', docId] });
      setCommentText('');
      setReplyTo(null);
    },
    onError: (e: any) => Alert.alert('评论失败', e.message),
  });

  const handleSubmitComment = () => {
    if (!commentText.trim() || !selectedBlock) return;
    const body: { blockHash: string; content: string; rootId?: string } = {
      blockHash: selectedBlock.hash,
      content: commentText.trim(),
    };
    if (replyTo) body.rootId = replyTo.root_id ?? replyTo.id;
    createMutation.mutate(body);
  };

  const goToChapter = useCallback((idx: number) => {
    const ch = chapters[idx];
    if (!ch) return;
    const startBlock = blocks[ch.blockStart];
    const y = startBlock ? (headingOffsets.current[startBlock.hash] ?? 0) : 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    setCurrentChapterIdx(idx);
  }, [chapters, blocks]);

  // ── 滚动监听：进度 + 触底翻页 + 当前章节 ────────────────────────────────
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const totalScrollable = contentSize.height - layoutMeasurement.height;
      if (totalScrollable > 0) {
        const progress = contentOffset.y / totalScrollable;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
        if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 300) {
          loadMore();
        }
        // 更新当前章节
        const y = contentOffset.y;
        let newIdx = 0;
        for (let i = 0; i < chapters.length; i++) {
          const sb = blocks[chapters[i].blockStart];
          const blockY = chapters[i].blockStart === 0 ? 0 : (sb ? (headingOffsets.current[sb.hash] ?? -1) : -1);
          if (blockY >= 0 && blockY <= y + 80) newIdx = i;
        }
        setCurrentChapterIdx(newIdx);
      }
    },
    [loadMore, blocks, chapters]
  );

  // ── 渲染单个段落 ──────────────────────────────────────────────────────────
  const renderBlock = (block: Block) => {
    const isHeading = block.type === 'heading';
    const displayContent = isHeading
      ? block.content.replace(/^#{1,6}\s+/, '')
      : block.content;
    const headingLevel = block.heading_level ?? 1;
    const commentCount = blockCommentCount[block.hash] ?? 0;
    const fontSize = isHeading
      ? headingLevel === 1 ? 20 : headingLevel === 2 ? 18 : 16
      : 17;

    return (
      <TouchableOpacity
        key={`${block.hash}-${block.id}`}
        style={[styles.block, isHeading && styles.headingBlock]}
        onPress={() => setSelectedBlock(block)}
        activeOpacity={0.75}
        onLayout={isHeading ? (e) => {
          headingOffsets.current[block.hash] = e.nativeEvent.layout.y;
        } : undefined}
      >
        <View style={styles.blockInner}>
          <Text
            style={[
              styles.blockText,
              {
                fontSize,
                fontWeight: isHeading ? '700' : '400',
                lineHeight: isHeading ? fontSize * 1.5 : fontSize * 1.85,
                textAlign: isHeading && headingLevel <= 2 ? 'center' : 'left',
              },
            ]}
          >
            {!isHeading && <Text style={{ color: 'transparent' }}>{'　　'}</Text>}
            {displayContent}
          </Text>
          {commentCount > 0 && (
            <View style={[styles.countBadge, isHeading && styles.countBadgeHeading]}>
              <Text style={styles.countBadgeText}>{commentCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalCommentCount = Object.values(blockCommentCount).reduce((a, b) => a + b, 0);
  const progressPercent = (scrollProgress * 100).toFixed(1) + '%';

  if (isLoading || (firstPageData && !docMeta)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#333" />
        <Text style={styles.loadingText}>加载中…</Text>
      </View>
    );
  }

  if (error || !firstPageData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>加载失败，请返回重试</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>← 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backTitle} numberOfLines={1}>{docMeta?.title}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {/* 目录按钮 */}
          <TouchableOpacity
            onPress={() => setShowToc(true)}
            style={styles.tocBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.tocBtnText}>目录</Text>
          </TouchableOpacity>
          <View style={styles.hotBadge}>
            <Text style={styles.hotLabel}>热评</Text>
            <Text style={styles.hotCount}>{totalCommentCount}</Text>
          </View>
        </View>
      </View>

      {/* Reading area */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        {blocks.map(renderBlock)}

        {/* 底部加载指示 */}
        {loadingMore ? (
          <View style={styles.loadMoreIndicator}>
            <ActivityIndicator size="small" color="#aaa" />
            <Text style={styles.loadMoreText}>加载更多…</Text>
          </View>
        ) : !hasMore && blocks.length > 0 ? (
          <View style={styles.loadMoreIndicator}>
            <Text style={styles.loadMoreText}>— 全文完 —</Text>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: progressPercent as any }]} />
      </View>

      {/* Chapter nav bar */}
      <View style={styles.chapterNavBar}>
        <TouchableOpacity
          style={[styles.chapterNavBtn, currentChapterIdx === 0 && styles.chapterNavBtnDisabled]}
          disabled={currentChapterIdx === 0}
          onPress={() => goToChapter(currentChapterIdx - 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.chapterNavBtnText, currentChapterIdx === 0 && styles.chapterNavBtnTextDisabled]}>‹ 上一章</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chapterNavCenter} onPress={() => setShowToc(true)} activeOpacity={0.7}>
          <Text style={styles.chapterNavTitle} numberOfLines={1}>
            {currentChapter?.title ?? docMeta?.title ?? ''}
          </Text>
          <Text style={styles.chapterNavProgress}>
            {chapters.length > 0 ? `${currentChapterIdx + 1} / ${chapters.length}` : progressPercent}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chapterNavBtn, currentChapterIdx >= chapters.length - 1 && styles.chapterNavBtnDisabled]}
          disabled={currentChapterIdx >= chapters.length - 1}
          onPress={() => goToChapter(currentChapterIdx + 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.chapterNavBtnText, currentChapterIdx >= chapters.length - 1 && styles.chapterNavBtnTextDisabled]}>下一章 ›</Text>
        </TouchableOpacity>
      </View>

      {/* TOC Modal */}
      <Modal
        visible={showToc}
        animationType="slide"
        transparent
        onRequestClose={() => setShowToc(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowToc(false)}
        />
        <View style={styles.tocDrawer}>
          <View style={styles.drawerHandle} />
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>目录</Text>
            <TouchableOpacity onPress={() => setShowToc(false)}>
              <Text style={styles.drawerClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={blocks.filter((b) => b.type === 'heading')}
            keyExtractor={(item) => item.hash}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
            renderItem={({ item }) => {
              const level = item.heading_level ?? 1;
              const title = item.content.replace(/^#{1,6}\s+/, '');
              return (
                <TouchableOpacity
                  style={[styles.tocItem, { paddingLeft: (level - 1) * 16 }]}
                  onPress={() => {
                    setShowToc(false);
                    const y = headingOffsets.current[item.hash];
                    if (y !== undefined) {
                      setTimeout(() => {
                        scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
                      }, 300);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.tocItemText,
                      level === 1 && styles.tocItemL1,
                      level === 2 && styles.tocItemL2,
                    ]}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                  {(blockCommentCount[item.hash] ?? 0) > 0 && (
                    <View style={styles.tocBadge}>
                      <Text style={styles.tocBadgeText}>{blockCommentCount[item.hash]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ color: '#ccc', fontSize: 14 }}>本文档无章节标题</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Comment Drawer */}
      <Modal
        visible={!!selectedBlock}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedBlock(null); setReplyTo(null); }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => { setSelectedBlock(null); setReplyTo(null); }}
        />
        <View style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>
              {(blockCommentCount[selectedBlock?.hash ?? ''] ?? 0) > 0
                ? `${blockCommentCount[selectedBlock?.hash ?? '']} 条评论`
                : '发表评论'}
            </Text>
            <TouchableOpacity onPress={() => { setSelectedBlock(null); setReplyTo(null); }}>
              <Text style={styles.drawerClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 排序 Tab */}
          {rawBlockComments.length > 1 && (
            <View style={styles.sortBar}>
              {(['newest', 'oldest', 'hot'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sortBtn, commentSort === s && styles.sortBtnActive]}
                  onPress={() => setCommentSort(s)}
                >
                  <Text style={[styles.sortBtnText, commentSort === s && styles.sortBtnTextActive]}>
                    {s === 'newest' ? '最新' : s === 'oldest' ? '最早' : '最热'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedBlock && (
            <View style={styles.selectedPreview}>
              <Text style={styles.selectedPreviewText} numberOfLines={2}>
                {selectedBlock.type === 'heading'
                  ? selectedBlock.content.replace(/^#{1,6}\s+/, '')
                  : selectedBlock.content}
              </Text>
            </View>
          )}

          <FlatList
            data={blockComments}
            keyExtractor={(item) => item.id}
            style={styles.commentList}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                onReply={(c) => setReplyTo(c)}
                blockHash={selectedBlock?.hash || ''}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>还没有评论，来发表第一条吧 ✍️</Text>
              </View>
            }
          />

          {user && (
            <View style={styles.inputArea}>
              {replyTo && (
                <View style={styles.replyingToBar}>
                  <Text style={styles.replyingToText}>回复 @{replyTo.username}</Text>
                  <TouchableOpacity onPress={() => setReplyTo(null)}>
                    <Text style={styles.cancelReply}>取消</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={replyTo ? `回复 @${replyTo.username}…` : '说点什么…'}
                  placeholderTextColor="#aaa"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
                  onPress={handleSubmitComment}
                  disabled={!commentText.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.sendBtnText}>发送</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f4ef' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f4ef' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#aaa' },
  errorText: { color: '#888', fontSize: 15, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#333', borderRadius: 8 },
  retryBtnText: { color: '#fff', fontSize: 14 },

  // Header
  header: {
    backgroundColor: '#f5f4ef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  backIcon: { fontSize: 30, color: '#555', marginRight: 4, lineHeight: 34 },
  backTitle: { fontSize: 15, color: '#333', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tocBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tocBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  hotLabel: { fontSize: 12, color: '#888', marginRight: 4 },
  hotCount: { fontSize: 13, color: '#333', fontWeight: '600' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Block
  block: { marginBottom: 0, paddingVertical: 4 },
  headingBlock: { marginTop: 14, marginBottom: 2 },
  blockInner: { flexDirection: 'row', alignItems: 'flex-start' },
  blockText: { color: '#1a1a1a', flex: 1 },
  countBadge: {
    marginLeft: 6,
    marginTop: 8,
    minWidth: 24,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  countBadgeHeading: { marginTop: 5 },
  countBadgeText: { fontSize: 11, color: '#999', fontWeight: '500' },

  // 分页加载提示
  loadMoreIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadMoreText: { fontSize: 13, color: '#bbb' },

  // Progress
  progressBar: { height: 2, backgroundColor: '#e0e0e0' },
  progressFill: { height: 2, backgroundColor: '#888' },

  // Chapter nav bar
  chapterNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fafaf8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    gap: 4,
  },
  chapterNavBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  chapterNavBtnDisabled: { opacity: 0.3 },
  chapterNavBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chapterNavBtnTextDisabled: { color: '#9ca3af' },
  chapterNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  chapterNavTitle: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: '100%' },
  chapterNavProgress: { fontSize: 11, color: '#9ca3af', marginTop: 1 },

  // Drawer
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginTop: 10,
    marginBottom: 2,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  drawerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  drawerClose: { fontSize: 17, color: '#bbb', padding: 4 },

  // 排序 Tab
  sortBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  sortBtnActive: { backgroundColor: '#0d9488' },
  sortBtnText: { fontSize: 12, color: '#6b7280' },
  sortBtnTextActive: { color: '#fff', fontWeight: '600' },

  // TOC
  tocDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  tocItemText: { flex: 1, fontSize: 14, color: '#6b7280', lineHeight: 20 },
  tocItemL1: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tocItemL2: { fontSize: 14, fontWeight: '600', color: '#374151' },
  tocBadge: {
    marginLeft: 8,
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tocBadgeText: { fontSize: 11, color: '#9ca3af' },
  selectedPreview: {
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#f8f8f6',
    borderLeftWidth: 3,
    borderLeftColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  selectedPreviewText: { fontSize: 13, color: '#777', lineHeight: 20 },
  commentList: { maxHeight: SCREEN_HEIGHT * 0.36 },
  emptyComments: { paddingVertical: 28, alignItems: 'center' },
  emptyCommentsText: { color: '#ccc', fontSize: 14 },
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 8,
  },
  replyingToText: { fontSize: 12, color: '#666' },
  cancelReply: { fontSize: 12, color: '#aaa' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111',
    maxHeight: 90,
    backgroundColor: '#f9f9f9',
  },
  sendBtn: {
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
