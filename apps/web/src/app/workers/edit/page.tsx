'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { ArrowLeft, Save, Zap, Timer } from 'lucide-react';

function EditWorker() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const router = useRouter();
  const workers = useStore(s => s.workers);
  const updateWorker = useStore(s => s.updateWorker);
  const deleteWorker = useStore(s => s.deleteWorker);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '', phone: '', address: '', joiningDate: '',
    category: 'DAILY_WAGE', dailyWage: '', monthlySalary: '',
    overtimeRate: '', lateChargeRate: '', lateChargeUnit: 'PER_MINUTE',
    notes: '', isActive: 'true',
  });

  useEffect(() => {
    const w = workers.find(x => x.id === id);
    if (w) {
      setForm({
        fullName: w.fullName, phone: w.phone, address: w.address || '',
        joiningDate: w.joiningDate, category: w.category,
        dailyWage: w.dailyWage ? String(w.dailyWage) : '',
        monthlySalary: w.monthlySalary ? String(w.monthlySalary) : '',
        overtimeRate: w.overtimeRate ? String(w.overtimeRate) : '',
        lateChargeRate: w.lateChargeRate ? String(w.lateChargeRate) : '',
        lateChargeUnit: w.lateChargeUnit || 'PER_MINUTE',
        notes: w.notes || '', isActive: String(w.isActive),
      });
    }
  }, [id, workers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    updateWorker(id, {
      fullName: form.fullName.trim(), phone: form.phone.trim(),
      address: form.address.trim() || undefined, joiningDate: form.joiningDate,
      category: form.category as 'DAILY_WAGE' | 'MONTHLY_SALARY',
      dailyWage: form.dailyWage ? parseFloat(form.dailyWage) : undefined,
      monthlySalary: form.monthlySalary ? parseFloat(form.monthlySalary) : undefined,
      overtimeRate: form.overtimeRate ? parseFloat(form.overtimeRate) : undefined,
      lateChargeRate: form.lateChargeRate ? parseFloat(form.lateChargeRate) : undefined,
      lateChargeUnit: form.lateChargeUnit as 'PER_MINUTE' | 'PER_HOUR',
      notes: form.notes.trim() || undefined, isActive: form.isActive === 'true',
    });
    router.push(`/workers/detail?id=${id}`);
  };

  const handleDelete = () => {
    if (!confirm('Delete this worker? This cannot be undone.')) return;
    deleteWorker(id);
    router.push('/workers');
  };

  const worker = workers.find(x => x.id === id);
  if (!worker) return <AppShell><div className="p-6 text-center text-gray-400">Worker not found</div></AppShell>;

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/workers/detail?id=${id}`} className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h2 className="text-xl font-bold text-gray-900">Edit Worker</h2>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            {[
              { label: 'Full Name', key: 'fullName', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Address', key: 'address', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                <input type={f.type} value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Joining Date</label>
              <input type="date" value={form.joiningDate} onChange={e => setForm(p => ({ ...p, joiningDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            {form.category === 'DAILY_WAGE' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Wage (₹)</label>
                <input type="number" value={form.dailyWage} onChange={e => setForm(p => ({ ...p, dailyWage: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Salary (₹)</label>
                <input type="number" value={form.monthlySalary} onChange={e => setForm(p => ({ ...p, monthlySalary: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Rates & Charges</h3>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Zap className="w-4 h-4 text-blue-500" /> Overtime Rate (₹/hr)
              </label>
              <input type="number" value={form.overtimeRate} onChange={e => setForm(p => ({ ...p, overtimeRate: e.target.value }))}
                placeholder="leave blank to auto-calculate" min="0" step="10"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Timer className="w-4 h-4 text-amber-500" /> Late Charge
              </label>
              <div className="flex gap-2">
                <input type="number" value={form.lateChargeRate} onChange={e => setForm(p => ({ ...p, lateChargeRate: e.target.value }))}
                  placeholder="e.g. 2" min="0" step="0.5"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <select value={form.lateChargeUnit} onChange={e => setForm(p => ({ ...p, lateChargeUnit: e.target.value }))}
                  className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="PER_MINUTE">₹ / minute</option>
                  <option value="PER_HOUR">₹ / hour</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit"
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-all">
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </form>

        <button onClick={handleDelete}
          className="w-full mt-3 py-3.5 rounded-xl font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all">
          Delete Worker
        </button>
      </div>
    </AppShell>
  );
}

export default function EditWorkerPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><EditWorker /></Suspense>;
}
