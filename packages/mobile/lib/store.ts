import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from './api';

interface AuthState {
  token: string | null;
  user: User | null;
  initialized: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  initialized: false,

  login: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null });
  },

  loadFromStorage: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userStr = await SecureStore.getItemAsync('auth_user');
    const user = userStr ? (JSON.parse(userStr) as User) : null;
    set({ token, user, initialized: true });
  },

  updateUser: async (user: User) => {
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ user });
  },
}));
