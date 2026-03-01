import { useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documents, comments } from '../../../lib/api';
import { useAuthStore } from '../../../lib/store';
import type { Block, Comment, CommentWithReplies } from '../../../lib/api';
import CommentItem from '../../../components/CommentItem';

export default function DocumentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docId = Number(id);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documents.get(docId),
  });

  const { data: blockComments = [] } = useQuery<CommentWithReplies[]>({
    queryKey: ['comments', selectedBlock?.hash],
    queryFn: () => comments.getByBlock(selectedBlock!.hash),
    enabled: !!selectedBlock,
  });

  const createMutation = useMutation({
    mutationFn: (body: { blockHash: string; content: string; rootId?: string; replyToUserId?: string }) =>
      comments.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', selectedBlock?.hash] });
      setCommentText('');
      setReplyTo(null);
    },
    onError: (e: any) => Alert.alert('评论失败', e.message),
  });

  const handleSubmitComment = () => {
    if (!commentText.trim() || !selectedBlock) return;
    const body: any = {
      blockHash: selectedBlock.hash,
      content: commentText.trim(),
    };
    if (replyTo) {
      body.rootId = replyTo.root_id ?? replyTo.id;
    }
    createMutation.mutate(body);
  };

  const renderBlock = (block: Block) => {
    const isHeading = block.type === 'heading';
    const displayContent = isHeading
      ? block.content.replace(/^#{1,6}\s+/, '')
      : block.content;
    const fontSize = isHeading
      ? block.heading_level === 1 ? 22 : block.heading_level === 2 ? 19 : 17
      : 15;

    return (
      <TouchableOpacity
        key={block.id}
        style={[styles.block, isHeading && styles.headingBlock]}
        onPress={() => setSelectedBlock(block)}
        activeOpacity={0.7}
      >
        <Text style={[styles.blockText, { fontSize, fontWeight: isHeading ? '700' : '400' }]}>
          {displayContent}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>文档加载失败</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{data.title}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Document content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        <Text style={styles.docTitle}>{data.title}</Text>
        {data.author && <Text style={styles.docAuthor}>{data.author}</Text>}
        <View style={styles.divider} />
        {data.blocks?.map(renderBlock)}
      </ScrollView>

      {/* Comment Modal */}
      <Modal
        visible={!!selectedBlock}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedBlock(null); setReplyTo(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>段落评论</Text>
              <TouchableOpacity onPress={() => { setSelectedBlock(null); setReplyTo(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Selected block preview */}
            {selectedBlock && (
              <View style={styles.blockPreview}>
                <Text style={styles.blockPreviewText} numberOfLines={3}>{selectedBlock.content}</Text>
              </View>
            )}

            {/* Comments list */}
            <FlatList
              data={blockComments}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              renderItem={({ item }) => (
                <CommentItem
                  comment={item}
                  onReply={(c) => setReplyTo(c)}
                  blockHash={selectedBlock?.hash || ''}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.noComments}>暂无评论，来发表第一条吧 ✍️</Text>
              }
            />

            {/* Input area */}
            {user && (
              <View style={styles.inputArea}>
                {replyTo && (
                  <View style={styles.replyingTo}>
                    <Text style={styles.replyingToText}>回复 @{replyTo.username}</Text>
                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                      <Text style={styles.cancelReply}>取消</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder={replyTo ? `回复 @${replyTo.username}…` : '说点什么…'}
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#6b7280', fontSize: 15 },
  header: {
    backgroundColor: '#0d9488',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
  },
  backBtn: { width: 60 },
  backText: { color: '#fff', fontSize: 14 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  content: { flex: 1 },
  contentPadding: { padding: 20, paddingBottom: 40 },
  docTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  docAuthor: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginBottom: 20 },
  block: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headingBlock: { backgroundColor: '#f0fdfa', borderColor: '#ccfbf1' },
  blockText: { color: '#1f2937', lineHeight: 24 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    flex: 1,
    marginTop: 80,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 18, color: '#6b7280' },
  blockPreview: {
    backgroundColor: '#f0fdfa',
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0d9488',
  },
  blockPreviewText: { fontSize: 13, color: '#374151', fontStyle: 'italic' },
  commentsList: { flex: 1, paddingHorizontal: 16 },
  noComments: { textAlign: 'center', color: '#9ca3af', marginTop: 30, fontSize: 14 },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#fff',
  },
  replyingTo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingToText: { fontSize: 13, color: '#0d9488' },
  cancelReply: { fontSize: 13, color: '#6b7280' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
