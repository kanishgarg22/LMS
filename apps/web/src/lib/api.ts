import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

// Request interceptor — attach token
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('lms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — on 401 clear stale token (auto-login will refresh on next page load)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_auth');
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { companyName: string; name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// ─── Workers ─────────────────────────────────────────────────────────────────
export const workersApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get('/workers', { params }),
  get: (id: string) => api.get(`/workers/${id}`),
  create: (data: FormData) =>
    api.post('/workers', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: FormData) =>
    api.put(`/workers/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/workers/${id}`),
  account: (id: string) => api.get(`/workers/${id}/account`),
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendanceApi = {
  register: (params?: { days?: number; date?: string } | number) => {
    const p = typeof params === 'number' ? { days: params } : params;
    return api.get('/attendance/register', { params: p });
  },
  mark: (data: {
    workerId: string;
    date: string;
    status: string;
    overtime?: string;
    overtimeHours?: number;
    lateMinutes?: number;
    halfDaySession?: string;
    notes?: string;
  }) => api.post('/attendance', data),
  bulkMark: (date: string, entries: Array<{
    workerId: string;
    status: string;
    overtime?: string;
    overtimeHours?: number;
  }>) => api.post('/attendance/bulk', { date, entries }),
  today: () => api.get('/attendance/today'),
  workerMonthly: (workerId: string, month: number, year: number) =>
    api.get(`/attendance/worker/${workerId}`, { params: { month, year } }),
  delete: (id: string) => api.delete(`/attendance/${id}`),
};

// ─── Payroll ─────────────────────────────────────────────────────────────────
export const payrollApi = {
  list: (month: number, year: number) => api.get('/payroll', { params: { month, year } }),
  generate: (month: number, year: number) => api.post('/payroll/generate', { month, year }),
  workerPayrolls: (workerId: string) => api.get(`/payroll/worker/${workerId}`),
  markPaid: (id: string) => api.post(`/payroll/${id}/pay`),
  summary: (month: number, year: number) => api.get('/payroll/summary', { params: { month, year } }),
};

// ─── Advances ─────────────────────────────────────────────────────────────────
export const advancesApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/advances', { params }),
  create: (data: { workerId: string; amount: number; purpose?: string; date: string }) =>
    api.post('/advances', data),
  repay: (id: string, amount: number) => api.post(`/advances/${id}/repay`, { amount }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  trends: (days?: number) => api.get('/dashboard/trends', { params: { days } }),
  monthlyExpense: (months?: number) => api.get('/dashboard/monthly-expense', { params: { months } }),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  attendance: (month: number, year: number, format = 'json') =>
    api.get('/reports/attendance', {
      params: { month, year, format },
      responseType: format !== 'json' ? 'blob' : 'json',
    }),
  salarySlip: (workerId: string, month: number, year: number, format = 'json') =>
    api.get(`/reports/salary-slip/${workerId}`, {
      params: { month, year, format },
      responseType: format !== 'json' ? 'blob' : 'json',
    }),
  payrollSummary: (month: number, year: number, format = 'json') =>
    api.get('/reports/payroll-summary', {
      params: { month, year, format },
      responseType: format !== 'json' ? 'blob' : 'json',
    }),
  workerAttendance: (workerId: string, from: string, to: string, format = 'pdf') =>
    api.get(`/reports/worker-attendance/${workerId}`, {
      params: { from, to, format },
      responseType: format !== 'json' ? 'blob' : 'json',
    }),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>) =>
    api.post('/ai/chat', { messages }),
};

// ─── Utils ────────────────────────────────────────────────────────────────────
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
