import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { comments } from '../lib/api';
import { useAuthStore } from '../lib/store';
import type { Comment, CommentWithReplies } from '../lib/api';

// 与 web 端相同的头像颜色算法
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#f43f5e', '#14b8a6'];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function Avatar({ name, avatarUrl, size = 34 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#f3f4f6' }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name || '?'), justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
};

// ── 回复项 ─────────────────────────────────────────────────────────────────
function ReplyItem({ reply, commentId, blockHash, onReplyTo }: {
  reply: Comment; commentId: string; blockHash: string;
  onReplyTo: (userId: string, username: string) => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [liked, setLiked] = useState(reply.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(reply.like_count ?? 0);

  const likeMutation = useMutation({
    mutationFn: () => comments.like(reply.id),
    onSuccess: (data) => { setLiked(data.liked); setLikeCount(data.likeCount); },
  });
  const deleteMutation = useMutation({
    mutationFn: () => comments.delete(reply.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', blockHash] }),
  });
  const canDelete = user?.is_admin || String(user?.id) === String(reply.user_id);

  return (
    <View style={styles.replyItem}>
      <Avatar name={reply.username || '匿名'} avatarUrl={reply.avatar_url} size={22} />
      <View style={styles.replyBody}>
        <View style={styles.replyMeta}>
          <Text style={styles.replyUsername}>{reply.username || '匿名用户'}</Text>
          {reply.reply_to_username && <Text style={styles.replyAt}>@ {reply.reply_to_username}</Text>}
          <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
        </View>
        <Text style={styles.replyContent}>{reply.content}</Text>
        <View style={styles.replyActions}>
          <TouchableOpacity onPress={() => likeMutation.mutate()} style={styles.actionBtn}>
            <Text style={[styles.actionText, liked && styles.liked]}>
              👍{likeCount > 0 ? ` ${likeCount}` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onReplyTo(reply.user_id, reply.username || '匿名用户')}>
            <Text style={styles.actionText}>回复</Text>
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity style={styles.actionBtn}
              onPress={() => Alert.alert('删除回复', '确认删除？', [
                { text: '取消', style: 'cancel' },
                { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate() },
              ])}>
              <Text style={[styles.actionText, styles.deleteText]}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── 主评论组件 ─────────────────────────────────────────────────────────────
interface Props {
  comment: CommentWithReplies;
  onReply?: (comment: Comment) => void; // 保留向后兼容，内部已自带输入框
  blockHash: string;
  docId?: string;
}

export default function CommentItem({ comment, blockHash }: Props) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ userId: string; username: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(comment.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(comment.like_count ?? 0);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const likeMutation = useMutation({
    mutationFn: () => comments.like(comment.id),
    onSuccess: (data) => { setLiked(data.liked); setLikeCount(data.likeCount); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => comments.delete(comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', blockHash] }),
    onError: (e: any) => Alert.alert('删除失败', e.message),
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      comments.create({ blockHash, content, rootId: comment.id, replyToUserId: replyingTo?.userId }),
    onSuccess: () => {
      setReplyText('');
      setShowReplyInput(false);
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', blockHash] });
    },
    onError: (e: any) => Alert.alert('回复失败', e.message),
  });

  const canDelete = user?.is_admin || String(user?.id) === String(comment.user_id);
  const replies = comment.replies ?? [];
  const replyCount = comment.reply_count ?? replies.length;

  const startReplyTo = (userId: string, username: string) => {
    setReplyingTo({ userId, username });
    setShowReplyInput(true);
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Avatar name={comment.username || '匿名'} avatarUrl={comment.avatar_url} />
        <View style={styles.meta}>
          <Text style={styles.username}>{comment.username || '匿名用户'}</Text>
          <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
        </View>
      </View>

      {/* 引用原文 */}
      {!!comment.selected_text && (
        <View style={styles.selectedTextBox}>
          <Text style={styles.selectedText} numberOfLines={3}>{comment.selected_text}</Text>
        </View>
      )}

      {/* 评论内容 */}
      <Text style={styles.content}>{comment.content}</Text>

      {/* 操作行 */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => likeMutation.mutate()} disabled={likeMutation.isPending}>
          <Text style={[styles.actionText, liked && styles.liked]}>
            👍{likeCount > 0 ? ` ${likeCount}` : ''}
          </Text>
        </TouchableOpacity>

        {user && (
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { setReplyingTo(null); setShowReplyInput(!showReplyInput); }}>
            <Text style={styles.actionText}>回复</Text>
          </TouchableOpacity>
        )}

        {replyCount > 0 && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReplies(!showReplies)}>
            <Text style={styles.primaryAction}>
              {showReplies ? '收起回复' : `查看 ${replyCount} 条回复`}
            </Text>
          </TouchableOpacity>
        )}

        {canDelete && (
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => Alert.alert('删除评论', '确认删除这条评论？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ])}>
            <Text style={[styles.actionText, styles.deleteText]}>删除</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 回复输入框 */}
      {showReplyInput && (
        <View style={styles.replyInputArea}>
          {replyingTo && (
            <View style={styles.replyingToBar}>
              <Text style={styles.replyingToText}>
                回复 <Text style={{ fontWeight: '600', color: '#111' }}>{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReplyTo}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={replyingTo ? `回复 ${replyingTo.username}…` : '写下回复…'}
              placeholderTextColor="#bbb"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !replyText.trim() && styles.sendBtnDisabled]}
              disabled={!replyText.trim() || replyMutation.isPending}
              onPress={() => replyMutation.mutate(replyText.trim())}
            >
              <Text style={styles.sendBtnText}>发送</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 回复列表 */}
      {showReplies && replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              commentId={comment.id}
              blockHash={blockHash}
              onReplyTo={startReplyTo}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  meta: { flex: 1 },
  username: { fontSize: 14, fontWeight: '600', color: '#111827' },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  selectedTextBox: { marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#d1d5db' },
  selectedText: { fontSize: 13, color: '#9ca3af', lineHeight: 20 },

  content: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },

  actions: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: {},
  actionText: { fontSize: 13, color: '#6b7280' },
  liked: { color: '#f97316' },
  deleteText: { color: '#ef4444' },
  primaryAction: { fontSize: 13, color: '#0d9488', fontWeight: '500' },

  replyInputArea: { marginTop: 10, backgroundColor: '#f9fafb', borderRadius: 8, padding: 8 },
  replyingToBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  replyingToText: { fontSize: 12, color: '#6b7280' },
  cancelReplyTo: { fontSize: 13, color: '#bbb', padding: 2 },
  replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: '#111',
    backgroundColor: '#fff',
    maxHeight: 80,
  },
  sendBtn: { backgroundColor: '#0d9488', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  sendBtnDisabled: { backgroundColor: '#e5e7eb' },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  repliesContainer: {
    marginTop: 10,
    marginLeft: 44,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
    gap: 10,
  },
  replyItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  replyBody: { flex: 1 },
  replyMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  replyUsername: { fontSize: 13, fontWeight: '600', color: '#374151' },
  replyAt: { fontSize: 12, color: '#9ca3af' },
  replyTime: { fontSize: 12, color: '#9ca3af' },
  replyContent: { fontSize: 13, color: '#374151', lineHeight: 20 },
  replyActions: { flexDirection: 'row', gap: 14, marginTop: 4 },
});
