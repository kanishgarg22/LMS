// ─── Enums ───────────────────────────────────────────────────────────────────

export enum WorkerCategory {
  DAILY_WAGE = 'DAILY_WAGE',
  MONTHLY_SALARY = 'MONTHLY_SALARY',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  HOLIDAY = 'HOLIDAY',
  LEAVE = 'LEAVE',
}

export enum OvertimeStatus {
  NONE = 'NONE',
  OT = 'OT',
}

export enum PaymentType {
  SALARY = 'SALARY',
  ADVANCE = 'ADVANCE',
  OVERTIME = 'OVERTIME',
  BONUS = 'BONUS',
  DEDUCTION = 'DEDUCTION',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  logo?: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  fullName: string;
  phone: string;
  address?: string;
  joiningDate: string;
  category: WorkerCategory;
  dailyWage?: number;
  monthlySalary?: number;
  profilePhoto?: string;
  notes?: string;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  workerId: string;
  date: string;
  status: AttendanceStatus;
  overtime: OvertimeStatus;
  overtimeHours?: number;
  notes?: string;
  markedById: string;
  createdAt: string;
  updatedAt: string;
  worker?: Worker;
}

export interface PayrollRecord {
  id: string;
  workerId: string;
  month: number;
  year: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  overtimeHours: number;
  basicSalary: number;
  overtimePay: number;
  advanceDeduction: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  carryForward: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  companyId: string;
  createdAt: string;
  worker?: Worker;
}

export interface Advance {
  id: string;
  workerId: string;
  amount: number;
  purpose?: string;
  date: string;
  repaidAmount: number;
  isFullyRepaid: boolean;
  companyId: string;
  createdAt: string;
  worker?: Worker;
}

export interface Payment {
  id: string;
  workerId: string;
  type: PaymentType;
  amount: number;
  date: string;
  month?: number;
  year?: number;
  notes?: string;
  companyId: string;
  createdAt: string;
  worker?: Worker;
}

// ─── API Response types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalWorkers: number;
  activeWorkers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  overtimeToday: number;
  pendingSalaries: number;
  monthlyExpense: number;
  totalAdvances: number;
  pendingDues: number;
}

export interface AttendanceTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  overtime: number;
}

// ─── Attendance register view ─────────────────────────────────────────────────

export interface AttendanceRegisterRow {
  worker: Worker;
  attendance: Record<string, { status: AttendanceStatus; overtime: OvertimeStatus; overtimeHours?: number } | null>;
}

export interface AttendanceRegister {
  dates: string[];
  rows: AttendanceRegisterRow[];
}

// ─── AI Assistant types ───────────────────────────────────────────────────────

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  action?: AIAction;
}

export interface AIAction {
  type: string;
  payload?: Record<string, unknown>;
  result?: unknown;
}

// ─── Auth types ───────────────────────────────────────────────────────────────

export interface AuthTokenPayload {
  userId: string;
  companyId: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  company: Company;
}
