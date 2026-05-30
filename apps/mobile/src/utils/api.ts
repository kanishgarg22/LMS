import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('lms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('lms_token');
      await AsyncStorage.removeItem('lms_user');
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const workersApi = {
  list: (params?: Record<string, string | number | boolean>) => api.get('/workers', { params }),
  get: (id: string) => api.get(`/workers/${id}`),
  account: (id: string) => api.get(`/workers/${id}/account`),
};

export const attendanceApi = {
  register: (days?: number) => api.get('/attendance/register', { params: { days } }),
  mark: (data: { workerId: string; date: string; status: string; overtime?: string; overtimeHours?: number }) =>
    api.post('/attendance', data),
  today: () => api.get('/attendance/today'),
};

export const payrollApi = {
  list: (month: number, year: number) => api.get('/payroll', { params: { month, year } }),
  summary: (month: number, year: number) => api.get('/payroll/summary', { params: { month, year } }),
  generate: (month: number, year: number) => api.post('/payroll/generate', { month, year }),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  trends: (days?: number) => api.get('/dashboard/trends', { params: { days } }),
};

export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>) => api.post('/ai/chat', { messages }),
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
