import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { User } from '@/types';

interface UserState {
  user: User | null;
  isLoggedIn: boolean;
  token: string | null;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoggedIn: false,
  token: null,

  setUser: (user: User) => {
    set({ user, isLoggedIn: true });
    get().saveToStorage();
  },

  setToken: (token: string) => {
    set({ token });
    Taro.setStorageSync('token', token);
  },

  logout: () => {
    set({ user: null, isLoggedIn: false, token: null });
    Taro.removeStorageSync('token');
    Taro.removeStorageSync('user');
  },

  loadFromStorage: async () => {
    try {
      const token = Taro.getStorageSync('token');
      const user = Taro.getStorageSync('user');
      if (token && user) {
        set({ token, user, isLoggedIn: true });
      }
    } catch (e) {
      console.error('加载用户信息失败', e);
    }
  },

  saveToStorage: async () => {
    const { user, token } = get();
    if (user) {
      Taro.setStorageSync('user', user);
    }
    if (token) {
      Taro.setStorageSync('token', token);
    }
  }
}));

export default useUserStore;
