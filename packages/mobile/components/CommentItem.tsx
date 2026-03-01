import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { comments } from '../lib/api';
import { useAuthStore } from '../lib/store';
import type { Comment } from '../lib/api';

interface Props {
  comment: Comment;
  onReply: (comment: Comment) => void;
  blockHash: string;
}

export default function CommentItem({ comment, onReply, blockHash }: Props) {
  const [showReplies, setShowReplies] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const likeMutation = useMutation({
    mutationFn: () => comments.like(comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', blockHash] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => comments.delete(comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', blockHash] }),
    onError: (e: any) => Alert.alert('删除失败', e.message),
  });

  const { data: replies = [] } = useQuery<Comment[]>({
    queryKey: ['replies', comment.id],
    queryFn: () => comments.getReplies(comment.id),
    enabled: showReplies,
  });

  const handleDelete = () => {
    Alert.alert('删除评论', '确认删除这条评论？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m}分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}小时前`;
    return `${Math.floor(h / 24)}天前`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{comment.username[0].toUpperCase()}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.username}>{comment.username}</Text>
          <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.content}>{comment.content}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => likeMutation.mutate()}
          disabled={likeMutation.isPending}
        >
          <Text style={[styles.actionText, comment.is_liked && styles.liked]}>
            {comment.is_liked ? '❤️' : '🤍'} {comment.like_count}
          </Text>
        </TouchableOpacity>

        {user && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(comment)}>
            <Text style={styles.actionText}>回复</Text>
          </TouchableOpacity>
        )}

        {comment.reply_count > 0 && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReplies(!showReplies)}>
            <Text style={styles.actionText}>
              {showReplies ? '收起回复' : `查看 ${comment.reply_count} 条回复`}
            </Text>
          </TouchableOpacity>
        )}

        {user && user.id === comment.user_id && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Text style={[styles.actionText, styles.deleteText]}>删除</Text>
          </TouchableOpacity>
        )}
      </View>

      {showReplies && replies.length > 0 && (
        <View style={styles.replies}>
          {replies.map((reply) => (
            <View key={reply.id} style={styles.replyItem}>
              <View style={styles.replyHeader}>
                <Text style={styles.replyUsername}>{reply.username}</Text>
                <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
              </View>
              <Text style={styles.replyContent}>{reply.content}</Text>
              <TouchableOpacity onPress={() => likeMutation.mutate()}>
                <Text style={styles.smallAction}>
                  {reply.is_liked ? '❤️' : '🤍'} {reply.like_count}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  meta: {},
  username: { fontSize: 14, fontWeight: '600', color: '#111827' },
  time: { fontSize: 12, color: '#9ca3af' },
  content: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 16 },
  actionBtn: {},
  actionText: { fontSize: 13, color: '#6b7280' },
  liked: { color: '#ef4444' },
  deleteText: { color: '#ef4444' },
  replies: {
    marginTop: 10,
    marginLeft: 14,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
  replyItem: { marginBottom: 10 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  replyUsername: { fontSize: 13, fontWeight: '600', color: '#374151' },
  replyTime: { fontSize: 12, color: '#9ca3af' },
  replyContent: { fontSize: 13, color: '#374151', lineHeight: 20 },
  smallAction: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});
