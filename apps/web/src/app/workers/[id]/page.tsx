'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { workersApi } from '@/lib/api';
import { formatCurrency, formatDate, getAttStatusClass, getAttStatusShort } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft, Phone, MapPin, Calendar, IndianRupee, TrendingUp,
  CreditCard, AlertCircle, User, Pencil, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkerAccountPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{
    worker: {
      id: string; fullName: string; phone: string; address?: string;
      joiningDate: string; category: string; dailyWage?: number;
      monthlySalary?: number; isActive: boolean; notes?: string;
      attendances: Array<{ id: string; date: string; status: string; overtime: string; overtimeHours?: number }>;
      payrolls: Array<{ id: string; month: number; year: number; netSalary: number; isPaid: boolean; presentDays: number; absentDays: number }>;
      advances: Array<{ id: string; amount: number; repaidAmount: number; date: string; purpose?: string }>;
    };
    summary: {
      totalPaid: number;
      totalAdvances: number;
      pendingAdvances: number;
      pendingSalaries: number;
      totalPayrolls: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    workersApi.account(id as string)
      .then(res => setData(res.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="p-6 text-center text-gray-400">Worker not found</div>
      </AppShell>
    );
  }

  const { worker, summary } = data;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'advances', label: 'Advances' },
  ];

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/workers" className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Worker Account</h2>
          </div>
          <Link href={`/workers/${id}/edit`} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Link>
        </div>

        {/* Worker profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-2xl flex-shrink-0">
              {worker.fullName[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{worker.fullName}</h3>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <Phone className="w-3.5 h-3.5" /> {worker.phone}
                    </span>
                    {worker.address && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5" /> {worker.address}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  worker.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {worker.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {formatDate(worker.joiningDate)}
                </div>
                <div className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-xl">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {worker.category === 'DAILY_WAGE'
                    ? `${formatCurrency(worker.dailyWage || 0)}/day`
                    : `${formatCurrency(worker.monthlySalary || 0)}/month`}
                </div>
                <div className="text-sm bg-gray-50 text-gray-600 px-3 py-1.5 rounded-xl">
                  {worker.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly Salary'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Paid', value: formatCurrency(summary.totalPaid), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
            { label: 'Pending Salary', value: formatCurrency(summary.pendingSalaries), icon: AlertCircle, color: 'text-orange-600 bg-orange-50' },
            { label: 'Total Advances', value: formatCurrency(summary.totalAdvances), icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
            { label: 'Pending Advances', value: formatCurrency(summary.pendingAdvances), icon: Clock, color: 'text-red-600 bg-red-50' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className={`w-8 h-8 rounded-xl ${card.color} flex items-center justify-center mb-2`}>
                <card.icon className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 min-w-max py-2 px-4 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase">Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  {worker.attendances.slice(0, 30).map(att => (
                    <tr key={att.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-sm text-gray-700">{formatDate(att.date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-1 rounded-lg border ${getAttStatusClass(att.status)}`}>
                          {att.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">
                        {att.overtime === 'OT' ? `OT ${att.overtimeHours}h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="space-y-3">
            {worker.payrolls.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                No payroll records yet
              </div>
            ) : worker.payrolls.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {new Date(2000, p.month - 1).toLocaleString('default', { month: 'long' })} {p.year}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.presentDays} present · {p.absentDays} absent
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(p.netSalary)}</p>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    p.isPaid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                  )}>
                    {p.isPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'advances' && (
          <div className="space-y-3">
            {worker.advances.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                No advances recorded
              </div>
            ) : worker.advances.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">{formatCurrency(Number(a.amount))}</p>
                  <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
                </div>
                {a.purpose && <p className="text-xs text-gray-500 mb-2">{a.purpose}</p>}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Repaid: {formatCurrency(Number(a.repaidAmount))}</span>
                  <span className={cn(
                    'font-medium',
                    Number(a.repaidAmount) >= Number(a.amount) ? 'text-green-600' : 'text-red-600'
                  )}>
                    Pending: {formatCurrency(Number(a.amount) - Number(a.repaidAmount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h4 className="font-semibold text-gray-700 mb-3 text-sm">Recent Attendance (Last 7 days)</h4>
              <div className="flex gap-2 flex-wrap">
                {worker.attendances.slice(0, 7).map(att => (
                  <div key={att.id} className="text-center">
                    <div className="text-xs text-gray-400 mb-1">
                      {new Date(att.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${getAttStatusClass(att.status)}`}>
                      {getAttStatusShort(att.status, att.overtime)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {worker.notes && (
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                <p className="text-sm text-amber-800">{worker.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
