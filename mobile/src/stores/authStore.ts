import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  name: string;
  role: string;
  shopId: string;
  mobile: string;
  shopName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  biometricsEnabled: boolean;
  rememberMe: boolean;
  setSession: (token: string, user: User) => Promise<void>;
  clearSession: () => Promise<void>;
  setBiometrics: (enabled: boolean) => void;
  setRememberMe: (remember: boolean) => void;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  biometricsEnabled: false,
  rememberMe: true,

  setSession: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null });
  },

  setBiometrics: (biometricsEnabled) => {
    set({ biometricsEnabled });
  },

  setRememberMe: (rememberMe) => {
    set({ rememberMe });
  },

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userStr = await SecureStore.getItemAsync('auth_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr) });
      }
    } catch (err) {
      console.error('Failed to load session from SecureStore', err);
    }
  }
}));
