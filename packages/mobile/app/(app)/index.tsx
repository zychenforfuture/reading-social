import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { documents } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import type { Document } from '../../lib/api';

export default function DocumentListPage() {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const { data = [], isLoading, refetch, isRefetching } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: documents.list,
  });

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/epub+zip', 'text/html'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      setUploading(true);
      await documents.upload(formData);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      Alert.alert('上传成功', '文档已上传并正在处理');
    } catch (e: any) {
      if (!e.message?.includes('canceled')) {
        Alert.alert('上传失败', e.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确认退出？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/document/${item.id}`)}
    >
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.cardMeta}>
        {item.author || '未知作者'} · {new Date(item.created_at).toLocaleDateString('zh-CN')}
      </Text>
      {item.block_count != null && (
        <Text style={styles.cardBlocks}>{item.block_count} 个段落</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>共鸣阅读</Text>
        <View style={styles.headerActions}>
          {user?.is_admin && (
            <TouchableOpacity onPress={handleUpload} disabled={uploading} style={styles.headerBtn}>
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.headerBtnText}>上传</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>退出</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>暂无文档</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#0d9488"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#0d9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardMeta: { fontSize: 13, color: '#6b7280' },
  cardBlocks: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af' },
});
