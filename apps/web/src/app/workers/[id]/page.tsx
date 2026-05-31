'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate, getAttStatusClass, getAttStatusShort } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Calendar, IndianRupee, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkerAccountPage() {
  const { id } = useParams<{ id: string }>();
  const workers = useStore(s => s.workers);
  const attendance = useStore(s => s.attendance);
  const advances = useStore(s => s.advances);
  const payrolls = useStore(s => s.payrolls);
  const [activeTab, setActiveTab] = useState('overview');

  const worker = workers.find(w => w.id === id);

  const workerAtt = useMemo(() =>
    attendance.filter(a => a.workerId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, id]
  );
  const workerAdv = useMemo(() =>
    advances.filter(a => a.workerId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [advances, id]
  );
  const workerPayrolls = useMemo(() =>
    payrolls.filter(p => p.workerId === id).sort((a, b) => b.year - a.year || b.month - a.month),
    [payrolls, id]
  );

  const summary = useMemo(() => ({
    totalPaid:       workerPayrolls.filter(p => p.isPaid).reduce((s, p) => s + p.netSalary, 0),
    pendingSalaries: workerPayrolls.filter(p => !p.isPaid).reduce((s, p) => s + p.netSalary, 0),
    totalAdvances:   workerAdv.reduce((s, a) => s + a.amount, 0),
    pendingAdvances: workerAdv.filter(a => !a.isFullyRepaid).reduce((s, a) => s + a.amount - a.repaidAmount, 0),
  }), [workerPayrolls, workerAdv]);

  if (!worker) return (
    <AppShell>
      <div className="p-6 text-center text-gray-400">Worker not found</div>
    </AppShell>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'advances', label: 'Advances' },
  ];

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/workers" className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1"><h2 className="text-xl font-bold text-gray-900">Worker Account</h2></div>
          <Link href={`/workers/${id}/edit`} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
        </div>

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
                    <span className="flex items-center gap-1 text-sm text-gray-500"><Phone className="w-3.5 h-3.5" /> {worker.phone}</span>
                    {worker.address && <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" /> {worker.address}</span>}
                    <span className="flex items-center gap-1 text-sm text-gray-500"><Calendar className="w-3.5 h-3.5" /> Joined {formatDate(worker.joiningDate)}</span>
                  </div>
                </div>
                <span className={cn('px-3 py-1 rounded-full text-sm font-medium', worker.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {worker.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{worker.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly Salary'}</span>
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-0.5">
                  <IndianRupee className="w-3.5 h-3.5" />
                  {worker.category === 'DAILY_WAGE' ? formatCurrency(worker.dailyWage || 0) + '/day' : formatCurrency(worker.monthlySalary || 0) + '/month'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Paid', value: formatCurrency(summary.totalPaid), color: 'text-green-600' },
            { label: 'Pending Salary', value: formatCurrency(summary.pendingSalaries), color: 'text-orange-600' },
            { label: 'Total Advances', value: formatCurrency(summary.totalAdvances), color: 'text-blue-600' },
            { label: 'Pending Advances', value: formatCurrency(summary.pendingAdvances), color: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={cn('text-lg font-bold mt-1', c.color)}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn('flex-1 py-2 text-sm font-medium rounded-lg transition-all', activeTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            {[
              { label: 'Category', value: worker.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly Salary' },
              { label: 'Rate', value: worker.category === 'DAILY_WAGE' ? formatCurrency(worker.dailyWage||0)+'/day' : formatCurrency(worker.monthlySalary||0)+'/month' },
              { label: 'Overtime Rate', value: worker.overtimeRate ? formatCurrency(worker.overtimeRate)+'/hr' : 'Auto (1.5×)' },
              { label: 'Late Charge', value: worker.lateChargeRate ? `₹${worker.lateChargeRate}/${worker.lateChargeUnit==='PER_MINUTE'?'min':'hr'}` : '—' },
              { label: 'Notes', value: worker.notes || '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className="text-sm font-medium text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {workerAtt.length === 0 ? <p className="text-center text-gray-400 py-8">No attendance records</p> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Late</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {workerAtt.slice(0,60).map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{formatDate(a.date)}</td>
                      <td className="px-4 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getAttStatusClass(a.status))}>{getAttStatusShort(a.status, a.overtime ?? 'NONE', a.lateMinutes)}</span></td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{a.lateMinutes ? `${a.lateMinutes}m` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{a.overtimeHours ? `${a.overtimeHours}h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {workerPayrolls.length === 0 ? <p className="text-center text-gray-400 py-8">No payroll records. Generate payroll from the Payment page.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Net Salary</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Days</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workerPayrolls.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{new Date(p.year,p.month-1).toLocaleString('en-IN',{month:'long',year:'numeric'})}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(p.netSalary)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{p.presentDays}/{p.totalDays}</td>
                      <td className="px-4 py-2.5 text-right"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',p.isPaid?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700')}>{p.isPaid?'Paid':'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'advances' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {workerAdv.length === 0 ? <p className="text-center text-gray-400 py-8">No advance records</p> : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Purpose</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workerAdv.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{formatDate(a.date)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{a.purpose||'—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(a.amount)}</td>
                      <td className="px-4 py-2.5 text-right"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',a.isFullyRepaid?'bg-green-100 text-green-700':'bg-red-100 text-red-700')}>{a.isFullyRepaid?'Repaid':'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
