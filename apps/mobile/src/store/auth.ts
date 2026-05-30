import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User { id: string; name: string; email: string; role: string; companyId: string; }
interface Company { id: string; name: string; logo?: string; }

interface AuthState {
  token: string | null;
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: User, company: Company) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  company: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (token, user, company) => {
    await AsyncStorage.setItem('lms_token', token);
    await AsyncStorage.setItem('lms_user', JSON.stringify({ user, company }));
    set({ token, user, company, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.removeItem('lms_token');
    await AsyncStorage.removeItem('lms_user');
    set({ token: null, user: null, company: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await AsyncStorage.getItem('lms_token');
      const stored = await AsyncStorage.getItem('lms_user');
      if (token && stored) {
        const { user, company } = JSON.parse(stored);
        set({ token, user, company, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
