import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { auth } from '../../lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('提示', '请先输入邮箱');
      return;
    }
    setCodeSending(true);
    try {
      await auth.sendCode(email.trim(), 'register');
      startCountdown();
      Alert.alert('成功', '验证码已发送，请查收邮件');
    } catch (e: any) {
      Alert.alert('发送失败', e.message);
    } finally {
      setCodeSending(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !username || !code || !password) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次密码输入不一致');
      return;
    }
    if (password.length < 6) {
      Alert.alert('提示', '密码至少6位');
      return;
    }
    setLoading(true);
    try {
      await auth.register(email.trim(), username.trim(), password, code.trim());
      Alert.alert('注册成功', '请登录', [
        { text: '确定', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: any) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>创建账号</Text>
          <Text style={styles.subtitle}>加入共鸣阅读社区</Text>

          <View style={styles.field}>
            <Text style={styles.label}>邮箱</Text>
            <View style={styles.codeRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                placeholder="请输入邮箱"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.codeBtn, countdown > 0 && styles.codeBtnDisabled]}
                onPress={handleSendCode}
                disabled={countdown > 0 || codeSending}
              >
                {codeSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.codeBtnText}>
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>验证码</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入邮箱验证码"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>用户名</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入用户名"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>密码</Text>
            <TextInput
              style={styles.input}
              placeholder="至少6位"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>确认密码</Text>
            <TextInput
              style={styles.input}
              placeholder="再次输入密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>注册</Text>
            )}
          </TouchableOpacity>

          <View style={styles.links}>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>已有账号？立即登录</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#0d9488', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 96,
    alignItems: 'center',
  },
  codeBtnDisabled: { backgroundColor: '#9ca3af' },
  codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  links: { alignItems: 'center', marginTop: 20 },
  link: { color: '#0d9488', fontSize: 14 },
});
