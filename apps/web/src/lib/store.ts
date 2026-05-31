import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calculatePayroll } from './payroll';

export type WorkerCategory = 'DAILY_WAGE' | 'MONTHLY_SALARY';
export type LateChargeUnit = 'PER_MINUTE' | 'PER_HOUR';
export type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' | 'LEAVE';
export type OTStatus = 'NONE' | 'OT';

export interface Worker {
  id: string;
  fullName: string;
  phone: string;
  address?: string;
  joiningDate: string; // YYYY-MM-DD
  category: WorkerCategory;
  dailyWage?: number;
  monthlySalary?: number;
  overtimeRate?: number;
  lateChargeRate?: number;
  lateChargeUnit: LateChargeUnit;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AttRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttStatus;
  overtime: OTStatus;
  overtimeHours?: number | null;
  lateMinutes?: number | null;
  halfDaySession?: string | null;
}

export interface Advance {
  id: string;
  workerId: string;
  amount: number;
  repaidAmount: number;
  purpose?: string;
  date: string; // YYYY-MM-DD
  isFullyRepaid: boolean;
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
  deductions: number;
  netSalary: number;
  isPaid: boolean;
  paidAt?: string;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface AppState {
  companyName: string;
  workers: Worker[];
  attendance: AttRecord[];
  advances: Advance[];
  payrolls: PayrollRecord[];

  setCompanyName: (name: string) => void;

  addWorker: (data: Omit<Worker, 'id' | 'createdAt'>) => Worker;
  updateWorker: (id: string, data: Partial<Omit<Worker, 'id' | 'createdAt'>>) => void;
  deleteWorker: (id: string) => void;

  markAttendance: (data: Omit<AttRecord, 'id'>) => AttRecord;

  addAdvance: (data: { workerId: string; amount: number; purpose?: string; date: string }) => Advance;

  generatePayroll: (month: number, year: number) => PayrollRecord[];
  markPaid: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      companyName: 'My Company',
      workers: [],
      attendance: [],
      advances: [],
      payrolls: [],

      setCompanyName: (name) => set({ companyName: name }),

      addWorker: (data) => {
        const worker: Worker = { ...data, id: uid(), createdAt: new Date().toISOString() };
        set(s => ({ workers: [...s.workers, worker] }));
        return worker;
      },

      updateWorker: (id, data) =>
        set(s => ({ workers: s.workers.map(w => w.id === id ? { ...w, ...data } : w) })),

      deleteWorker: (id) =>
        set(s => ({ workers: s.workers.filter(w => w.id !== id) })),

      markAttendance: (data) => {
        const { attendance } = get();
        const existing = attendance.find(a => a.workerId === data.workerId && a.date === data.date);
        if (existing) {
          const updated: AttRecord = { ...existing, ...data };
          set(s => ({ attendance: s.attendance.map(a => a.id === existing.id ? updated : a) }));
          return updated;
        }
        const record: AttRecord = { ...data, id: uid() };
        set(s => ({ attendance: [...s.attendance, record] }));
        return record;
      },

      addAdvance: (data) => {
        const advance: Advance = { ...data, id: uid(), repaidAmount: 0, isFullyRepaid: false };
        set(s => ({ advances: [...s.advances, advance] }));
        return advance;
      },

      generatePayroll: (month, year) => {
        const { workers, attendance, advances, payrolls } = get();
        const activeWorkers = workers.filter(w => w.isActive);
        const results: PayrollRecord[] = [];

        for (const worker of activeWorkers) {
          const workerAtt = attendance.filter(a => {
            if (a.workerId !== worker.id) return false;
            const [y, m] = a.date.split('-').map(Number);
            return y === year && m === month;
          });

          const pendingAdv = advances.filter(a => a.workerId === worker.id && !a.isFullyRepaid);
          const totalAdv = pendingAdv.reduce((s, a) => s + a.amount - a.repaidAmount, 0);

          const calc = calculatePayroll({
            category: worker.category,
            dailyWage: worker.dailyWage,
            monthlySalary: worker.monthlySalary,
            joiningDate: new Date(worker.joiningDate),
            month, year,
            attendances: workerAtt.map(a => ({
              date: new Date(a.date),
              status: a.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY' | 'LEAVE',
              overtime: a.overtime as 'NONE' | 'OT',
              overtimeHours: a.overtimeHours ?? null,
              lateMinutes: a.lateMinutes ?? null,
            })),
            advances: totalAdv,
            overtimeRate: worker.overtimeRate,
            lateChargeRate: worker.lateChargeRate,
            lateChargeUnit: worker.lateChargeUnit,
          });

          const existing = payrolls.find(p => p.workerId === worker.id && p.month === month && p.year === year);
          const record: PayrollRecord = {
            id: existing?.id ?? uid(),
            workerId: worker.id,
            month, year,
            isPaid: existing?.isPaid ?? false,
            paidAt: existing?.paidAt,
            ...calc,
          };
          results.push(record);
        }

        set(s => {
          const filtered = s.payrolls.filter(p => !(p.month === month && p.year === year));
          return { payrolls: [...filtered, ...results] };
        });

        return results;
      },

      markPaid: (id) =>
        set(s => ({
          payrolls: s.payrolls.map(p =>
            p.id === id ? { ...p, isPaid: true, paidAt: new Date().toISOString() } : p
          ),
        })),
    }),
    {
      name: 'lms_data',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
    }
  )
);
