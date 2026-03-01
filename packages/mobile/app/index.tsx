import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { token, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(app)/" />;
  }
  return <Redirect href="/(auth)/login" />;
}
