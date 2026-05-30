'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { payrollApi, reportsApi, downloadBlob } from '@/lib/api';
import { formatCurrency, getMonthName, getCurrentMonth } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Zap, CheckCircle, Download,
  FileText, TrendingUp, IndianRupee, AlertCircle, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollRecord {
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

interface Summary {
  totalWorkers: number;
  totalNet: number;
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
}

export default function PaymentPage() {
  const now = getCurrentMonth();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recRes, sumRes] = await Promise.all([
        payrollApi.list(month, year),
        payrollApi.summary(month, year),
      ]);
      setRecords(recRes.data.data);
      setSummary(sumRes.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const navigateMonth = (dir: number) => {
    const d = new Date(year, month - 1 + dir);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  const generatePayroll = async () => {
    setGenerating(true);
    setError('');
    try {
      await payrollApi.generate(month, year);
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  const markPaid = async (id: string) => {
    try {
      await payrollApi.markPaid(id);
      const rec = records.find(r => r.id === id);
      if (!rec) return;
      setRecords(prev => prev.map(r => r.id === id ? { ...r, isPaid: true } : r));
      setSummary(prev => prev ? {
        ...prev,
        totalPaid: prev.totalPaid + Number(rec.netSalary),
        totalPending: prev.totalPending - Number(rec.netSalary),
        paidCount: prev.paidCount + 1,
        pendingCount: prev.pendingCount - 1,
      } : prev);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Failed to mark as paid');
    }
  };

  const downloadExcel = async () => {
    try {
      const res = await reportsApi.payrollSummary(month, year, 'xlsx');
      downloadBlob(res.data as Blob, `payroll-${month}-${year}.xlsx`);
    } catch {
      setError('Failed to download report');
    }
  };

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Payment</h2>
            <p className="text-sm text-gray-500">{getMonthName(month)} {year}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadExcel} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={generatePayroll}
              disabled={generating}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              <Zap className="w-4 h-4" />
              {generating ? 'Syncing…' : 'Sync Payment'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
            <button onClick={load} className="flex items-center gap-1 text-xs font-medium hover:underline flex-shrink-0">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Month nav */}
        <div className="flex items-center justify-center gap-4 bg-white rounded-2xl border border-gray-100 p-3">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 text-lg w-40 text-center">
            {getMonthName(month)} {year}
          </span>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Workers', value: String(summary.totalWorkers), color: 'text-blue-600 bg-blue-50' },
              { label: 'Total Payroll', value: formatCurrency(summary.totalNet), color: 'text-purple-600 bg-purple-50' },
              { label: `Paid (${summary.paidCount})`, value: formatCurrency(summary.totalPaid), color: 'text-green-600 bg-green-50' },
              { label: `Pending (${summary.pendingCount})`, value: formatCurrency(summary.totalPending), color: 'text-orange-600 bg-orange-50' },
            ].map((card, i) => (
              <div key={i} className={`rounded-2xl p-4 ${card.color.split(' ')[1]}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <IndianRupee className={`w-4 h-4 ${card.color.split(' ')[0]}`} />
                  <p className={`text-lg font-bold ${card.color.split(' ')[0]}`}>{card.value}</p>
                </div>
                <p className="text-xs font-medium text-gray-600">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Payroll table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No payment records for this month</p>
            <p className="text-gray-400 text-sm mt-1">Click "Sync Payment" to calculate salaries from attendance</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase">Worker</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 uppercase">Days</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 uppercase">OT Hrs</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3 uppercase">Basic (₹)</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3 uppercase">OT Pay (₹)</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3 uppercase">Deductions (₹)</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 uppercase">Net Pay (₹)</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 uppercase">Status</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => {
                    const totalDeductions = Number(rec.advanceDeduction) + Number(rec.deductions || 0);
                    return (
                      <tr key={rec.id} className={cn('border-t border-gray-50 hover:bg-gray-50/50', idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20')}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{rec.worker.fullName}</p>
                          <p className="text-xs text-gray-400">{rec.worker.category === 'DAILY_WAGE' ? 'Daily' : 'Monthly'}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-700">
                          {rec.presentDays}<span className="text-gray-400">/{rec.presentDays + rec.absentDays}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-700">{Number(rec.overtimeHours).toFixed(1)}</td>
                        <td className="px-3 py-3 text-right text-sm text-gray-700">{formatCurrency(Number(rec.basicSalary))}</td>
                        <td className="px-3 py-3 text-right text-sm text-blue-600 font-medium">
                          {Number(rec.overtimePay) > 0 ? `+ ${formatCurrency(Number(rec.overtimePay))}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-red-500">
                          {totalDeductions > 0 ? `− ${formatCurrency(totalDeductions)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">{formatCurrency(Number(rec.netSalary))}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-full font-medium',
                            rec.isPaid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                          )}>
                            {rec.isPaid ? '✓ Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!rec.isPaid && (
                              <button
                                onClick={() => markPaid(rec.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" /> Mark Paid
                              </button>
                            )}
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer totals */}
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sm text-gray-700" colSpan={3}>
                      Total ({records.length} workers)
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-sm text-gray-700">
                      {formatCurrency(records.reduce((s, r) => s + Number(r.basicSalary), 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-sm text-blue-600">
                      {formatCurrency(records.reduce((s, r) => s + Number(r.overtimePay), 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-sm text-red-500">
                      {formatCurrency(records.reduce((s, r) => s + Number(r.advanceDeduction) + Number(r.deductions || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">
                      {formatCurrency(records.reduce((s, r) => s + Number(r.netSalary), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
