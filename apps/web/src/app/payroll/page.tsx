'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStore } from '@/lib/store';
import { formatCurrency, getMonthName, getCurrentMonth } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Zap, CheckCircle, TrendingUp, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollRow {
  id: string;
  workerId: string;
  month: number;
  year: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  overtimeHours: number;
  basicSalary: number;
  overtimePay: number;
  advanceDeduction: number;
  deductions: number;
  netSalary: number;
  isPaid: boolean;
  worker: { fullName: string; phone: string; category: string };
}

export default function PaymentPage() {
  const now = getCurrentMonth();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const workers = useStore(s => s.workers);
  const payrolls = useStore(s => s.payrolls);
  const generatePayroll = useStore(s => s.generatePayroll);
  const markPaid = useStore(s => s.markPaid);

  const records: PayrollRow[] = payrolls
    .filter(p => p.month === month && p.year === year)
    .map(p => {
      const w = workers.find(x => x.id === p.workerId);
      return { ...p, worker: w ? { fullName: w.fullName, phone: w.phone, category: w.category } : { fullName: 'Unknown', phone: '', category: '' } };
    })
    .sort((a, b) => a.worker.fullName.localeCompare(b.worker.fullName));

  const summary = {
    totalWorkers: records.length,
    totalNet: records.reduce((s, p) => s + p.netSalary, 0),
    totalPaid: records.filter(p => p.isPaid).reduce((s, p) => s + p.netSalary, 0),
    totalPending: records.filter(p => !p.isPaid).reduce((s, p) => s + p.netSalary, 0),
    paidCount: records.filter(p => p.isPaid).length,
    pendingCount: records.filter(p => !p.isPaid).length,
  };

  const navigateMonth = (dir: number) => {
    const d = new Date(year, month - 1 + dir);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      generatePayroll(month, year);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = (id: string) => { markPaid(id); };

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment</h2>
            <p className="text-sm text-gray-500">Payroll management</p>
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        {/* Month navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <div className="text-center">
            <p className="font-bold text-gray-900">{getMonthName(month)} {year}</p>
            <p className="text-xs text-gray-400 mt-0.5">{records.length} workers</p>
          </div>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>

        {/* Summary cards */}
        {summary.totalWorkers > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Payroll', value: formatCurrency(summary.totalNet), icon: IndianRupee, color: 'text-primary' },
              { label: 'Paid', value: formatCurrency(summary.totalPaid), icon: CheckCircle, color: 'text-green-600' },
              { label: 'Pending', value: formatCurrency(summary.totalPending), icon: AlertCircle, color: 'text-orange-500' },
              { label: 'Paid / Total', value: `${summary.paidCount}/${summary.totalWorkers}`, icon: TrendingUp, color: 'text-blue-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={cn('w-4 h-4', c.color)} />
                  <p className="text-xs text-gray-500">{c.label}</p>
                </div>
                <p className={cn('text-lg font-bold', c.color)}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Records */}
        {records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No payroll for this month</p>
            <p className="text-sm mt-1">Click Generate Payroll to calculate salaries</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.worker.fullName}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                        p.isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                        {p.isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{p.worker.phone}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      <span>Present: {p.presentDays}d</span>
                      <span>Absent: {p.absentDays}d</span>
                      {p.lateDays > 0 && <span>Late: {p.lateDays}d</span>}
                      {p.overtimeHours > 0 && <span>OT: {p.overtimeHours}h</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                      <span>Basic: {formatCurrency(p.basicSalary)}</span>
                      {p.overtimePay > 0 && <span className="text-purple-600">+OT: {formatCurrency(p.overtimePay)}</span>}
                      {p.advanceDeduction > 0 && <span className="text-red-500">-Adv: {formatCurrency(p.advanceDeduction)}</span>}
                      {p.deductions > 0 && <span className="text-orange-500">-Late: {formatCurrency(p.deductions)}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(p.netSalary)}</p>
                    {!p.isPaid && (
                      <button onClick={() => handleMarkPaid(p.id)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-xl text-xs font-semibold hover:bg-green-600 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
