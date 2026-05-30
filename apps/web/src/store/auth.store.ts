import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
  logo?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User, company: Company) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      company: null,
      isAuthenticated: false,
      setAuth: (token, user, company) => {
        localStorage.setItem('lms_token', token);
        set({ token, user, company, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_user');
        set({ token: null, user: null, company: null, isAuthenticated: false });
      },
    }),
    { name: 'lms_auth' }
  )
);
