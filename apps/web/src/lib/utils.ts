import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM');
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
}

export function getAttStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    LATE: 'Late',
    HALF_DAY: 'Half Day',
    HOLIDAY: 'Holiday',
    LEAVE: 'Leave',
  };
  return labels[status] || status;
}

export function getAttStatusShort(status: string, overtime: string, lateMinutes?: number | null): string {
  const shorts: Record<string, string> = {
    PRESENT: 'P',
    ABSENT: 'A',
    LATE: 'L',
    HALF_DAY: 'H',
    HOLIDAY: 'Ho',
    LEAVE: 'Le',
  };
  let base = shorts[status] || '?';
  if (status === 'LATE' && lateMinutes && lateMinutes > 0) {
    const h = Math.floor(lateMinutes / 60);
    const m = lateMinutes % 60;
    if (h > 0 && m > 0) base = `L ${h}h${m}m`;
    else if (h > 0) base = `L ${h}h`;
    else base = `L ${m}m`;
  }
  return overtime === 'OT' ? `${base}+OT` : base;
}

export function formatLateTime(lateMinutes: number): string {
  const h = Math.floor(lateMinutes / 60);
  const m = lateMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function getAttStatusClass(status: string | null): string {
  if (!status) return 'att-empty';
  const map: Record<string, string> = {
    PRESENT: 'att-present',
    ABSENT: 'att-absent',
    LATE: 'att-late',
    HALF_DAY: 'att-halfday',
    HOLIDAY: 'att-holiday',
    LEAVE: 'att-holiday',
  };
  return map[status] || 'att-empty';
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentMonth(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}
