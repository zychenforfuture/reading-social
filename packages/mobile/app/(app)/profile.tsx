import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { auth } from '../../lib/api';
import { useAuthStore } from '../../lib/store';

// DiceBear 预设头像（与 Web 端一致）
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Max',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Lily',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Milo',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Bob',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Charlie',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Diana',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Eve',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Frank',
];

function AvatarDisplay({ url, username, size = 80 }: { url?: string | null; username?: string; size?: number }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#fff' }}
        resizeMode="cover"
      />
    );
  }
  const initial = (username || '?')[0].toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#0d9488',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<'avatar' | 'password'>('avatar');

  // 头像 tab 状态
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  // 密码 tab 状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateAvatarMutation = useMutation({
    mutationFn: (url: string) => auth.updateProfile(url),
    onSuccess: (data) => {
      updateUser(data.user);
      Alert.alert('成功', '头像已更新');
      setSelectedAvatar(null);
    },
    onError: (e: any) => Alert.alert('更新失败', e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => auth.changePassword(oldPassword, newPassword),
    onSuccess: () => {
      Alert.alert('成功', '密码已修改，请重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e: any) => Alert.alert('修改失败', e.message),
  });

  const handleSaveAvatar = () => {
    const url = selectedAvatar ?? user?.avatar_url ?? '';
    if (!url) return Alert.alert('提示', '请先选择一个头像');
    updateAvatarMutation.mutate(url);
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      return Alert.alert('提示', '请填写所有字段');
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('提示', '两次输入的新密码不一致');
    }
    if (newPassword.length < 6) {
      return Alert.alert('提示', '新密码至少需要 6 位');
    }
    changePasswordMutation.mutate();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>个人资料</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Avatar Hero */}
      <View style={styles.hero}>
        <AvatarDisplay url={selectedAvatar ?? user?.avatar_url} username={user?.username} size={88} />
        <Text style={styles.heroName}>{user?.username}</Text>
        <Text style={styles.heroEmail}>{user?.email}</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'avatar' && styles.tabActive]}
          onPress={() => setTab('avatar')}
        >
          <Text style={[styles.tabText, tab === 'avatar' && styles.tabTextActive]}>更换头像</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'password' && styles.tabActive]}
          onPress={() => setTab('password')}
        >
          <Text style={[styles.tabText, tab === 'password' && styles.tabTextActive]}>修改密码</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {tab === 'avatar' ? (
          <>
            <Text style={styles.sectionTitle}>选择预设头像</Text>
            <FlatList
              data={PRESET_AVATARS}
              numColumns={4}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.avatarOption, selectedAvatar === item && styles.avatarOptionSelected]}
                  onPress={() => setSelectedAvatar(item)}
                >
                  <Image source={{ uri: item }} style={styles.avatarOptionImg} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ gap: 10 }}
              columnWrapperStyle={{ gap: 10 }}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, (!selectedAvatar && !user?.avatar_url) && styles.primaryBtnDisabled]}
              onPress={handleSaveAvatar}
              disabled={updateAvatarMutation.isPending}
            >
              {updateAvatarMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>保存头像</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>修改密码</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>当前密码</Text>
              <TextInput
                style={styles.input}
                placeholder="输入当前密码"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>新密码</Text>
              <TextInput
                style={styles.input}
                placeholder="至少 6 位"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>确认新密码</Text>
              <TextInput
                style={styles.input}
                placeholder="再次输入新密码"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (!oldPassword || !newPassword || !confirmPassword) && styles.primaryBtnDisabled]}
              onPress={handleChangePassword}
              disabled={changePasswordMutation.isPending || !oldPassword || !newPassword || !confirmPassword}
            >
              {changePasswordMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>确认修改</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  // Header
  header: {
    backgroundColor: '#0d9488',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
  },
  backBtn: { width: 40 },
  backIcon: { fontSize: 30, color: '#fff', lineHeight: 34 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Hero
  hero: {
    backgroundColor: '#0d9488',
    alignItems: 'center',
    paddingBottom: 28,
    paddingTop: 4,
  },
  heroName: { marginTop: 12, fontSize: 18, fontWeight: '700', color: '#fff' },
  heroEmail: { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488' },
  tabText: { fontSize: 15, color: '#9ca3af' },
  tabTextActive: { color: '#0d9488', fontWeight: '600' },

  // Body
  body: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 16 },

  // Avatar grid
  avatarOption: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarOptionSelected: { borderColor: '#0d9488' },
  avatarOptionImg: { width: '100%', height: '100%' },

  // Password form
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
  },

  // Button
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#d1d5db' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
