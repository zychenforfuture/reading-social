import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../../lib/store';

export default function AppLayout() {
  const { token, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized && !token) {
      router.replace('/(auth)/login');
    }
  }, [initialized, token]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0d9488' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    />
  );
}
