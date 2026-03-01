import { useState, useRef, useCallback } from 'react';
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

export default function DocumentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = id as string; // UUID string, not a number
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);

  // Load document with blocks
  const { data, isLoading, error } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documents.get(docId),
    enabled: !!docId,
  });

  // Load block comment counts for the whole document
  const { data: blockCommentCount = {} } = useQuery<Record<string, number>>({
    queryKey: ['docCommentCount', docId],
    queryFn: () => documents.getBlockCommentCounts(docId),
    enabled: !!docId,
  });

  // Load comments for the selected block
  const { data: blockComments = [] } = useQuery<CommentWithReplies[]>({
    queryKey: ['comments', selectedBlock?.hash],
    queryFn: () => comments.getByBlock(selectedBlock!.hash),
    enabled: !!selectedBlock,
  });

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
    if (replyTo) {
      body.rootId = replyTo.root_id ?? replyTo.id;
    }
    createMutation.mutate(body);
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const totalScrollable = contentSize.height - layoutMeasurement.height;
      if (totalScrollable > 0) {
        const progress = contentOffset.y / totalScrollable;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
        const totalBlocks = data?.blocks?.length || 1;
        const estimatedPage = Math.ceil(progress * totalBlocks) || 1;
        setCurrentPage(Math.min(estimatedPage, totalBlocks));
      }
    },
    [data]
  );

  const totalCommentCount = Object.values(blockCommentCount).reduce((a, b) => a + b, 0);

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
        key={block.id}
        style={[styles.block, isHeading && styles.headingBlock]}
        onPress={() => setSelectedBlock(block)}
        activeOpacity={0.75}
      >
        <View style={styles.blockInner}>
          <Text
            style={[
              styles.blockText,
              {
                fontSize,
                fontWeight: isHeading ? '700' : '400',
                lineHeight: isHeading ? fontSize * 1.5 : fontSize * 1.85,
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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>加载失败，请返回重试</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>← 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalBlocks = data.blocks?.length || 1;
  const progressPercent = (scrollProgress * 100).toFixed(2) + '%';

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
          <Text style={styles.backTitle} numberOfLines={1}>{data.title}</Text>
        </TouchableOpacity>
        <View style={styles.hotBadge}>
          <Text style={styles.hotLabel}>热评</Text>
          <Text style={styles.hotCount}>{totalCommentCount}</Text>
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
        {data.blocks?.map(renderBlock)}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(scrollProgress * 100).toFixed(1)}%` as any }]} />
      </View>

      {/* Bottom status bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomBarText}>{currentPage}/{totalBlocks}</Text>
        <Text style={styles.bottomBarText}>{progressPercent}</Text>
      </View>

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

  // Progress
  progressBar: { height: 2, backgroundColor: '#e0e0e0' },
  progressFill: { height: 2, backgroundColor: '#888' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#f5f4ef',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  bottomBarText: { fontSize: 12, color: '#bbb' },

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
